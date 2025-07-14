import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as childProcess from "child_process";
import * as vscode from "vscode";
import { CliCache } from "../cache/types";
import { DaggerSettings } from "../settings";
import { DirectoryIdResult, ModuleResult, ModuleObject } from "./types";

// Type definitions for the CLI interface
export interface RunOptions {
  shell?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}

export interface CommandResult {
  code: number;
  exitCode?: number;
  stdout: string;
  stderr: string;
  success?: boolean;
}

export interface FunctionArgument {
  name: string;
  type: string;
  required: boolean;
}

export interface FunctionInfo {
  name: string;
  description?: string;
  functionId: string;
  module: string;
  isParentModule: boolean;
  parentModule?: string;
  returnType: string; // Add return type information
  args: FunctionArgument[];
}

// add tooltip method to FunctionInfo

export default class Cli {
  private readonly command = "dagger";
  private workspacePath?: string;
  private cache?: CliCache;
  private settings: DaggerSettings;

  constructor(settings: DaggerSettings, cache?: CliCache) {
    this.settings = settings;
    this.cache = cache;
  }

  /**
   * Runs the Dagger command with the specified arguments and options
   */
  public async run(
    args: string[] = [],
    options: RunOptions = {},
  ): Promise<CommandResult> {
    const { timeout = 30_000, cwd } = options;
    const command = `${this.command} ${args.join(" ")}`;

    try {
      if (cwd && !fs.existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}`);
      }

      const stdout = childProcess.execSync(command, {
        cwd: cwd ?? this.workspacePath ?? process.cwd(),
        timeout,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      return {
        code: 0,
        stdout: stdout.toString().trim(),
        stderr: "",
        exitCode: 0,
        success: true,
      };
    } catch (error: any) {
      return {
        code: error.status || 1,
        stdout: error.stdout?.toString().trim() || "",
        stderr:
          error.stderr?.toString().trim() || error.message || "Unknown error",
        exitCode: error.status || 1,
        success: false,
      };
    }
  }

  /**
   * Gets the list of functions available in the Dagger module for the given workspace path.
   * @param workspacePath The path to the Dagger project directory
   * @returns A Promise that resolves to an array of FunctionInfo objects
   * @description Retrieves all functions from the Dagger module and converts GraphQL type names
   * to user-friendly type names (e.g., OBJECT_STRING -> string, OBJECT_BOOLEAN -> boolean)
   */
  public async functionsList(workspacePath: string): Promise<FunctionInfo[]> {
    const cacheKey = this.createCacheKey("functions_list", workspacePath);

    // Check cache first (only if caching is enabled)
    if (this.cache && this.settings.enableCache) {
      const cachedFunctions = await this.cache.get<FunctionInfo[]>(cacheKey);
      if (cachedFunctions && cachedFunctions.length > 0) {
        console.log("Returning cached functions list");

        // Update cache in background if caching is enabled
        // Use a simple try/catch to avoid breaking tests
        try {
          if (this.settings.enableCache) {
            this.updateFunctionsListCache(workspacePath, cacheKey).catch(
              (error) => {
                console.error(
                  "Error updating functions list cache in background:",
                  error,
                );
              },
            );
          }
        } catch (error) {
          console.error("Error initiating background cache update:", error);
        }

        return cachedFunctions;
      }
    }

    // No cache, cache miss, or caching disabled - fetch directly
    const functions = await this.fetchFunctionsList(workspacePath);

    // Cache the result if caching is enabled
    if (this.cache && this.settings.enableCache && functions.length > 0) {
      await this.cache.set(cacheKey, functions);
    }

    return functions;
  }

  /**
   * Fetches the functions list from the Dagger CLI (without caching)
   * @param workspacePath The path to the Dagger project directory
   * @returns A Promise that resolves to an array of FunctionInfo objects
   * @private
   */
  private async fetchFunctionsList(
    workspacePath: string,
  ): Promise<FunctionInfo[]> {
    let functions: FunctionInfo[] = [];
    try {
      const id = await this.queryDirectoryId(workspacePath);
      if (!id) {
        console.warn(
          `Failed to get directory ID for workspace: ${workspacePath}`,
        );
        return [];
      }

      const objects = await this.queryModuleFunctions(id, workspacePath);
      if (!objects || objects.length === 0) {
        console.warn(
          `No functions found in Dagger module for workspace: ${workspacePath}`,
        );
        return [];
      }

      // First, identify the root module (if any)
      let rootModuleName = "";
      // Find modules that are parent modules (they have submodules)
      const parentModules = objects.filter((obj) => {
        const objName = obj.asObject?.name || obj.name || "";
        return objects.some((otherObj) => {
          const otherName = otherObj.asObject?.name || otherObj.name || "";
          return (
            otherName !== objName &&
            otherName.startsWith(objName) &&
            otherName.length > objName.length
          );
        });
      });

      // If there's only one parent module, consider it the root
      if (parentModules.length === 1) {
        rootModuleName =
          parentModules[0].asObject?.name || parentModules[0].name || "";
      }

      for (const obj of objects) {
        if (!obj.asObject) {
          console.warn(`Object ${obj.name} does not have asObject property`);
          continue;
        }

        if (!obj.asObject.functions || obj.asObject.functions.length === 0) {
          console.warn(`Object ${obj.name} has no functions defined`);
          continue;
        }

        // Get module name from object
        const moduleName = obj.asObject.name || obj.name || "";

        // Analyze module hierarchy based on naming patterns
        // Check if this module name appears as a prefix in other module names
        const isParentModule = objects.some((otherObj) => {
          const otherName = otherObj.asObject?.name || otherObj.name || "";
          return (
            otherName !== moduleName &&
            otherName.startsWith(moduleName) &&
            otherName.length > moduleName.length
          );
        });

        // Determine parent module (if any) by looking for the longest prefix match
        let parentModule: string | undefined = undefined;
        if (!isParentModule) {
          // This module might be a child - find potential parent with longest matching prefix
          let longestPrefixLength = 0;

          objects.forEach((otherObj) => {
            const otherName = otherObj.asObject?.name || otherObj.name || "";
            if (
              otherName !== moduleName &&
              moduleName.startsWith(otherName) &&
              otherName.length > longestPrefixLength
            ) {
              longestPrefixLength = otherName.length;
              parentModule = otherName;
            }
          });
        }

        // For parent modules, use empty string as module name
        // For submodules, extract the actual module name by removing the parent prefix
        let actualModuleName = "";

        if (isParentModule) {
          // Parent modules use empty string as module name
          actualModuleName = "";
        } else {
          // If this is a submodule of the root module, extract just the submodule name
          if (
            rootModuleName &&
            moduleName.startsWith(rootModuleName) &&
            moduleName !== rootModuleName
          ) {
            // Remove root module prefix to get the clean submodule name
            // This converts e.g. "dagger-dev-cli" to "cli" when root is "dagger-dev"
            actualModuleName = moduleName.substring(rootModuleName.length);

            // Clean up any separators at the beginning (like hyphens or underscores)
            actualModuleName = actualModuleName.replace(/^[-_]+/, "");
          } else if (parentModule) {
            // For other submodules, remove parent module prefix
            // Ensure parentModule is treated as a string
            const parentModuleStr: string = parentModule;
            actualModuleName = moduleName.substring(parentModuleStr.length);
            actualModuleName = actualModuleName.replace(/^[-_]+/, "");
          } else {
            // Regular module, use its name
            actualModuleName = moduleName;
          }
        }

        // Convert module name to kebab-case
        const moduleKebabName = actualModuleName
          ? this.camelCaseToKebabCase(actualModuleName)
          : "";

        for (const func of obj.asObject.functions) {
          // Format the full name and extract module context
          const kebabName = this.camelCaseToKebabCase(func.name);

          // Create the function info object with module information
          functions.push({
            name: kebabName,
            description: func.description,
            functionId: func.id,
            module: moduleKebabName, // Use cleaned, kebab-case module name
            isParentModule,
            parentModule: parentModule
              ? this.camelCaseToKebabCase(parentModule)
              : undefined, // Convert parent to kebab-case too
            returnType: this.getFriendlyTypeName(func.returnType), // Pass entire returnType object
            args: func.args.map((arg) => {
              // Primary method: Use the optional property if available
              // Fallback: Check description for [required] if optional property is not set
              const isRequired =
                arg.typeDef.optional === undefined
                  ? arg.description?.includes("[required]") || false
                  : !arg.typeDef.optional;

              return {
                name: this.camelCaseToKebabCase(arg.name),
                type: this.getFriendlyTypeName(arg.typeDef),
                required: isRequired,
              };
            }),
          });
        }
      }
    } catch (error: any) {
      console.error("Error retrieving functions from Dagger module:", error);
    }

    // Log the result for debugging
    console.log(`fetchFunctionsList found ${functions.length} functions`);

    return functions;
  }

  /**
   * Updates the functions list cache in the background
   * @param workspacePath The path to the Dagger project directory
   * @param cacheKey The cache key to update
   * @private
   */
  private async updateFunctionsListCache(
    workspacePath: string,
    cacheKey: string,
  ): Promise<void> {
    // Skip if caching is disabled
    if (!this.settings.enableCache) {
      return;
    }

    try {
      const freshFunctions = await this.fetchFunctionsList(workspacePath);
      if (this.cache && freshFunctions.length > 0) {
        // Check if data has actually changed using SHA256 comparison
        const hasChanged = await this.cache.hasDataChanged(
          cacheKey,
          freshFunctions,
        );
        if (hasChanged) {
          await this.cache.set(cacheKey, freshFunctions);
          console.log(
            "Updated functions list cache in background - data changed",
          );
        } else {
          console.log("Skipped functions list cache update - data unchanged");
        }
      }
    } catch (error) {
      console.error("Error updating functions list cache:", error);
    }
  }

  /**
   * Validates if the Dagger command is available in the system
   */
  public async isInstalled(): Promise<boolean> {
    const result = await this.run(["version"]);
    return result.stdout !== "" && result.stdout.includes("dagger");
  }

  /**
   * Checks if the current workspace is a Dagger project by looking for dagger.json
   * @returns A Promise that resolves to true if dagger.json exists, false otherwise
   */
  public async isDaggerProject(): Promise<boolean> {
    const projectRoot =
      this.workspacePath ??
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
      process.cwd();

    try {
      const stats = await fs.promises.stat(
        path.join(projectRoot, "dagger.json"),
      );
      return stats.isFile();
    } catch {
      return false; // If dagger.json file does not exist, return false
    }
  }

  /**
   * Queries the Dagger CLI to get the directory ID for the given workspace path.
   *
   * @param workspacePath The path to the Dagger project directory
   * @description Queries the Dagger CLI to get the directory ID for the given workspace path
   * @throws Error if the query fails or the directory ID is not found
   * @returns The directory ID as a string, or undefined if not found
   */
  public async queryDirectoryId(
    workspacePath: string,
  ): Promise<string | undefined> {
    const query = `
            query($path: String!) {
                host {
                    directory(path: $path) {
                        id
                    }
                }
            }
        `;

    const result = (await this.query(
      query,
      { path: workspacePath },
      workspacePath,
    )) as DirectoryIdResult;

    return result?.host?.directory?.id;
  }

  /**
   * Queries the Dagger CLI to get the list of functions for the given module.
   * @param directoryId The ID of the directory to query
   * @param workspacePath The path to the Dagger project directory
   * @returns A Promise that resolves to an array of ModuleObjects, each containing function details
   * @throws Error if the query fails or the module objects are not found
   * @description Queries the Dagger CLI to get the list of functions for the given module
   */
  public async queryModuleFunctions(
    directoryId: string,
    workspacePath: string,
  ): Promise<ModuleObject[]> {
    const query = `
            query($id: DirectoryID!) {
              loadDirectoryFromID(id: $id) {
                asModule {
                  id
                  description
                  name
                  objects {
                    asObject {
                      name
                      functions {
                        id
                        name
                        description
                        returnType {
                          kind
                          optional
                          asObject {
                            name
                          }
                        }
                        args {
                          name
                          description
                          typeDef {
                            kind
                            optional
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `;
    const result = (await this.query(
      query,
      { id: directoryId },
      workspacePath,
    )) as ModuleResult;
    // Return the objects array directly, filtering out any null or undefined entries
    return (
      result?.loadDirectoryFromID?.asModule?.objects?.filter(Boolean) ?? []
    );
  }

  /*
   * Sets the workspace path for the CLI commands
   * @param workspacePath The path to the workspace directory
   * @throws Error if the workspace path is invalid or does not exist
   */
  public setWorkspacePath(workspacePath: string) {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      throw new Error(`Invalid workspace path: ${workspacePath}`);
    }

    this.workspacePath = workspacePath;
  }

  /**
   * Queries the Dagger CLI to get a specific function by its ID.
   * @param functionId The ID of the function to query
   * @param workspacePath The path to the Dagger project directory
   * @returns A Promise that resolves to a FunctionInfo object with detailed function information
   * @throws Error if the query fails or the function is not found
   */
  public async queryFunctionByID(
    functionId: string,
    workspacePath: string,
  ): Promise<FunctionInfo | undefined> {
    const cacheKey = this.createCacheKey(
      "function_by_id",
      functionId,
      workspacePath,
    );

    // Check cache first (only if caching is enabled)
    if (this.cache && this.settings.enableCache) {
      const cachedFunction = await this.cache.get<FunctionInfo>(cacheKey);
      if (cachedFunction) {
        console.log(`Returning cached function for ID: ${functionId}`);

        // Update cache in background if caching is enabled
        // Use a simple try/catch to avoid breaking tests
        try {
          if (this.settings.enableCache) {
            this.updateFunctionByIDCache(
              functionId,
              workspacePath,
              cacheKey,
            ).catch((error) => {
              console.error(
                "Error updating function cache in background:",
                error,
              );
            });
          }
        } catch (error) {
          console.error("Error initiating background cache update:", error);
        }

        return cachedFunction;
      }
    }

    // No cache, cache miss, or caching disabled - fetch directly
    const functionInfo = await this.fetchFunctionByID(
      functionId,
      workspacePath,
    );

    // Cache the result if caching is enabled
    if (this.cache && this.settings.enableCache && functionInfo) {
      await this.cache.set(cacheKey, functionInfo);
    }

    return functionInfo;
  }

  /**
   * Fetches a function by ID from the Dagger CLI (without caching)
   * @param functionId The ID of the function to query
   * @param workspacePath The path to the Dagger project directory
   * @returns A Promise that resolves to a FunctionInfo object or undefined if not found
   * @private
   */
  private async fetchFunctionByID(
    functionId: string,
    workspacePath: string,
  ): Promise<FunctionInfo | undefined> {
    console.log(`fetchFunctionByID called with functionId: ${functionId}`);

    try {
      const query = `
                query($id: FunctionID!) {
                    loadFunctionFromID(id: $id) {
                        id
                        name
                        description
                        returnType {
                            kind
                            optional
                            asObject {
                              name
                            }
                        }
                        args {
                            name
                            description
                            typeDef {
                                kind
                                optional
                            }
                        }
                    }
                }
            `;

      console.log(`Executing GraphQL query for function ID: ${functionId}`);
      const result = await this.query(query, { id: functionId }, workspacePath);
      console.log(
        `Query result received: ${result ? "data returned" : "no data"}`,
      );

      const func = (result as any)?.loadFunctionFromID;

      if (!func) {
        console.warn(
          `Function with ID ${functionId} not found in GraphQL response`,
        );
        return undefined;
      }

      console.log(
        `Function data received: ${JSON.stringify({
          id: func.id,
          name: func.name,
          argsCount: func.args?.length || 0,
        })}`,
      );

      // Extract module name from function name if it contains a dot
      let moduleName = "";
      let isParentModule = false;

      if (func.name.includes(".")) {
        const fullModuleName = func.name.substring(0, func.name.indexOf("."));
        isParentModule = false;

        // Get the list of functions to determine root module
        const allFunctions = await this.functionsList(workspacePath);

        // Find the root module name (if any)
        // Look for a function that has isParentModule=true
        const rootModuleFuncs = allFunctions.filter((f) => f.isParentModule);
        let rootModuleName = "";

        if (rootModuleFuncs.length > 0) {
          // We found at least one parent module function, use its module name
          // The actual module name will be in the original name format (before kebab-case conversion)
          // Extract it from one of the functions
          const parentModuleFunc = rootModuleFuncs[0];
          // We need to analyze the original name to find the parent module name
          // First, find a function with this ID to get more context
          const matchingFunc = allFunctions.find(
            (f) => f.functionId === parentModuleFunc.functionId,
          );

          if (matchingFunc) {
            // Get parent module functions in original module names
            // For this, we need to get raw functions list from the API
            const directoryId = await this.queryDirectoryId(workspacePath);
            if (directoryId) {
              const objects = await this.queryModuleFunctions(
                directoryId,
                workspacePath,
              );
              if (objects && objects.length > 0) {
                // Find parent modules (they have submodules)
                const parentModules = objects.filter((obj) => {
                  const objName = obj.asObject?.name || obj.name || "";
                  return objects.some((otherObj) => {
                    const otherName =
                      otherObj.asObject?.name || otherObj.name || "";
                    return (
                      otherName !== objName &&
                      otherName.startsWith(objName) &&
                      otherName.length > objName.length
                    );
                  });
                });

                // If there's only one parent module, consider it the root
                if (parentModules.length === 1) {
                  rootModuleName =
                    parentModules[0].asObject?.name ||
                    parentModules[0].name ||
                    "";
                }
              }
            }
          }
        }

        // Now determine the clean module name
        if (
          rootModuleName &&
          fullModuleName.startsWith(rootModuleName) &&
          fullModuleName !== rootModuleName
        ) {
          // This is a submodule of the root module, extract just the submodule name
          // Remove root module prefix to get the clean submodule name
          moduleName = fullModuleName.substring(rootModuleName.length);

          // Clean up any separators at the beginning (like hyphens or underscores)
          moduleName = moduleName.replace(/^[-_]+/, "");
        } else {
          // Regular module or no root module found, use the full module name
          moduleName = fullModuleName;
        }
      } else {
        // This is a parent module function, use empty string for module name
        isParentModule = true;
      }

      // Convert module name to kebab-case (only if it's not empty)
      const moduleKebabName = moduleName
        ? this.camelCaseToKebabCase(moduleName)
        : "";

      // Convert GraphQL function data to FunctionInfo format
      return {
        name: this.camelCaseToKebabCase(func.name),
        description: func.description,
        functionId: func.id,
        module: moduleKebabName, // Use kebab-case module name or empty string for parent modules
        isParentModule: isParentModule, // Indicate if this is a parent module function
        parentModule: undefined, // We don't have context for determining parent here
        returnType: this.getFriendlyTypeName(func.returnType), // Pass entire returnType object
        args: func.args.map((arg: any) => {
          const isRequired =
            arg.typeDef.optional === undefined
              ? arg.description?.includes("[required]") || false
              : !arg.typeDef.optional;

          return {
            name: this.camelCaseToKebabCase(arg.name),
            type: this.getFriendlyTypeName(arg.typeDef),
            required: isRequired,
          };
        }),
      };
    } catch (error: any) {
      console.error(`Error retrieving function with ID ${functionId}:`, error);
      throw new Error(`Failed to retrieve function details: ${error.message}`);
    }
  }

  /**
   * Updates the function cache in the background
   * @param functionId The ID of the function to update
   * @param workspacePath The path to the Dagger project directory
   * @param cacheKey The cache key to update
   * @private
   */
  private async updateFunctionByIDCache(
    functionId: string,
    workspacePath: string,
    cacheKey: string,
  ): Promise<void> {
    // Skip if caching is disabled
    if (!this.settings.enableCache) {
      return;
    }

    try {
      const freshFunction = await this.fetchFunctionByID(
        functionId,
        workspacePath,
      );
      if (this.cache && freshFunction) {
        // Check if data has actually changed using SHA256 comparison
        const hasChanged = await this.cache.hasDataChanged(
          cacheKey,
          freshFunction,
        );
        if (hasChanged) {
          await this.cache.set(cacheKey, freshFunction);
          console.log(
            `Updated function cache for ID: ${functionId} - data changed`,
          );
        } else {
          console.log(
            `Skipped function cache update for ID: ${functionId} - data unchanged`,
          );
        }
      }
    } catch (error) {
      console.error(
        `Error updating function cache for ID ${functionId}:`,
        error,
      );
    }
  }

  /**
   * Gets detailed information about a function including its arguments using the function ID.
   *
   * @param functionId The unique identifier of the function to fetch
   * @param workspacePath The path to the workspace to run the command in
   * @returns A Promise that resolves to a FunctionInfo object or undefined if not found
   */
  public async getFunction(
    functionId: string,
    workspacePath: string,
  ): Promise<FunctionInfo | undefined> {
    console.log(
      `getFunction called with functionId: ${functionId}, workspacePath: ${workspacePath}`,
    );

    try {
      const functionInfo = await this.queryFunctionByID(
        functionId,
        workspacePath,
      );

      if (!functionInfo) {
        console.warn(`Function with ID ${functionId} not found`);
        return undefined;
      }

      console.log(
        `Function retrieved successfully: ${JSON.stringify({
          name: functionInfo.name,
          module: functionInfo.module,
          argsCount: functionInfo.args?.length || 0,
        })}`,
      );

      return functionInfo;
    } catch (error: any) {
      console.error(`Error in getFunction for ID ${functionId}:`, error);
      throw new Error(`Failed to get function details: ${error.message}`);
    }
  }

  /**
   * Sets the cache instance for this CLI
   * @param cache The cache instance to use
   */
  public setCache(cache: CliCache): void {
    this.cache = cache;
  }

  /**
   * Clears the cache if available
   */
  public async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
      console.log("Cache cleared");
    }
  }

  /**
   * @param str The string to convert from camelCase to kebab-case
   * @description Converts a camelCase string to kebab-case by inserting hyphens before uppercase letters
   * and converting the entire string to lowercase.
   * @returns The kebab-case version of the input string
   */
  private camelCaseToKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }

  /**
   * Executes a GraphQL query using the Dagger CLI with input variables and returns the parsed result.
   * @param query The GraphQL query string
   * @param variables The input variables as an object
   * @param options Optional run options
   */
  private async query(
    query: string,
    variables: Record<string, unknown> = {},
    path: string,
  ): Promise<unknown> {
    const varJson = JSON.stringify(variables);
    try {
      const child = require("child_process").spawn(
        this.command,
        ["query", "--var-json", varJson],
        {
          cwd: path,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.stdin.write(query);
      child.stdin.end();

      await new Promise((resolve, reject) => {
        child.on("close", (code: number) => {
          if (code !== 0) {
            reject(new Error(stderr || `Dagger exited with code ${code}`));
          } else {
            resolve(undefined);
          }
        });
      });

      return JSON.parse(stdout);
    } catch (error: any) {
      console.error("Error executing GraphQL query:", error);
      console.error("Query:", query);
      console.error("Variables:", varJson);
      console.error("Working directory:", path);
      throw new Error(
        `Failed to execute GraphQL query: ${error.message || error}`,
      );
    }
  }

  /**
   * Converts GraphQL type names to friendly type names.
   * @param typeInfo The GraphQL type info object or string
   * @returns A friendly type name (e.g., string, boolean, object, Container, Directory)
   * @private
   */
  private getFriendlyTypeName(typeInfo: any): string {
    // If typeInfo is a string, use legacy behavior
    if (typeof typeInfo === "string") {
      const graphQLType = typeInfo;
      // Handle null or undefined
      if (!graphQLType) {
        return "unknown";
      }

      // Handle common GraphQL type prefixes
      if (graphQLType.startsWith("OBJECT_")) {
        const typeWithoutPrefix = graphQLType.substring(7).toLowerCase();

        // Map specific type names
        switch (typeWithoutPrefix) {
          case "string":
            return "string";
          case "int":
          case "integer":
            return "number";
          case "float":
          case "double":
            return "number";
          case "boolean":
            return "boolean";
          case "object":
            return "object";
          case "array":
            return "array";
          case "list":
            return "array";
          case "map":
            return "object";
          case "void":
          case "nil":
          case "null":
            return "null";
          default:
            return typeWithoutPrefix;
        }
      }

      // Handle GraphQL scalar types
      switch (graphQLType.toUpperCase()) {
        case "STRING":
          return "string";
        case "INT":
        case "INTEGER":
        case "FLOAT":
          return "number";
        case "BOOLEAN":
          return "boolean";
        case "ID":
          return "string";
        default:
          // If we can't map it, just lowercase the original type
          return graphQLType.toLowerCase();
      }
    }

    // If typeInfo is an object with asObject.name, use that
    if (typeInfo && typeof typeInfo === "object") {
      // If we have asObject.name, use that as it's more specific
      if (typeInfo.asObject && typeInfo.asObject.name) {
        return typeInfo.asObject.name;
      }

      // Otherwise, fall back to the kind
      if (typeInfo.kind) {
        return this.getFriendlyTypeName(typeInfo.kind);
      }
    }

    // Default fallback
    return "unknown";
  }

  /**
   * Creates a consistent MD5 hash of the provided key for safer cache storage
   * @param keyType Type of cache key (e.g., 'function', 'functions_list')
   * @param identifiers Additional identifiers to include in the key
   * @returns MD5 hashed cache key
   * @private
   */
  private createCacheKey(keyType: string, ...identifiers: string[]): string {
    const rawKey = `${keyType}_${identifiers.join("_")}`;
    return crypto.createHash("md5").update(rawKey).digest("hex");
  }
}
