import fs from "fs";
import {
  DirectoryIdResult,
  FunctionInfo,
  ModuleObject,
  ModuleResult,
  FunctionArg,
  ModuleFunction,
} from "./types/types";
import { DaggerSettings } from "./settings";
import { CliCache } from "./cache";
import { getArgumentTypeName, getReturnTypeName } from "./utils/type-helpers";
import { nameToKebabCase } from "./utils/modules";

export interface Output {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd: string;
  stdin?: string;
  env?: Record<string, string>;
  timeout?: number;
}

const queryHostDirectory = `query hostDirectory($path: String!) {
    host {
        directory(path: $path) {
            id
        }
    }
}`;

const queryFunctions = `query directoryAsModule($id: DirectoryID!) {
  loadDirectoryFromID(id: $id) {
    name
    asModule {
      id
      name
      objects {
        asObject {
          name
          id
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
                asObject {
                  name
                }
                kind
                optional
              }
            }
          }
        }
      }
    }
  }
}`;

export class DaggerCLI {
  constructor(
    private cache: CliCache,
    private settings: DaggerSettings,
  ) {
    this.cache = cache;
    this.settings = settings;
  }

  /**
   * Clears the cache.
   * This method removes all cached data.
   */
  clearCache(): void {
    this.cache.clear();
    console.log("Cache cleared successfully.");
  }

  /**
   * Retrieves the functions defined in the Dagger project at the specified path.
   * This method executes a GraphQL query to fetch the functions and their details.
   *
   * @param path The path to the Dagger project.
   * @returns A promise that resolves to an array of FunctionInfo objects.
   */
  async getFunctions(path: string): Promise<FunctionInfo[]> {
    const cacheKey = this.cache.generateKey("functions", path);
    // is cache enabled?
    if (this.settings.enableCache) {
      console.log(`Checking cache for key: ${cacheKey}`);

      const cachedFunctions = await this.cache.get<FunctionInfo[]>(cacheKey);
      if (cachedFunctions) {
        console.debug(`Using cached functions for key: ${cacheKey}`);
        return cachedFunctions;
      }

      console.debug(`No cached functions found for key: ${cacheKey}`);
    }

    const { stdout, stderr, exitCode } = await this.execQuery(
      queryFunctions,
      { id: await this.getDirectoryID(path) },
      path,
    );

    if (exitCode !== 0) {
      console.error("Failed to get functions:", stderr);
      throw new Error(`Failed to get functions: ${stderr}`);
    }

    let result: ModuleResult;
    try {
      result = JSON.parse(stdout);

      const rootModuleName = nameToKebabCase(
        result.loadDirectoryFromID.asModule.name,
      );

      console.debug(`Root module name: ${rootModuleName}`);

      if (!result.loadDirectoryFromID.asModule.objects) {
        console.error("Invalid functions response:", stdout);
        throw new Error("Invalid functions response");
      }

      const functions: FunctionInfo[] = [];
      const moduleNames: string[] = [];

      result.loadDirectoryFromID.asModule.objects.forEach(
        (moduleObj: ModuleObject) => {
          if (moduleObj.asObject) {
            moduleNames.push(nameToKebabCase(moduleObj.asObject.name));
          }
        },
      );

      console.debug(`Found ${moduleNames.length} modules: ${moduleNames.join(", ")}`);

      result.loadDirectoryFromID.asModule.objects.forEach(
        (moduleObj: ModuleObject) => {
          if (moduleObj.asObject && moduleObj.asObject.functions) {
            // make sure the module name is defined
            if (!moduleObj.asObject.name) {
              console.warn("Module name is undefined, skipping module");
              return;
            }

            // if returnType.kind is "OBJECT_KIND" and returnType.asObject.name begins with the PascalCase module name, strip the module name prefix as this is a submodule

            const fullModuleName = nameToKebabCase(moduleObj.asObject.name);

            // Check if this is the root module by comparing with the shortest module name
            const isRootModule = fullModuleName === rootModuleName;

            // For submodules, strip the root module prefix if present to get clean submodule name
            let moduleName: string | undefined;
            if (!isRootModule && fullModuleName.startsWith(rootModuleName)) {
              // Strip the root module prefix (e.g., "dagger-dev-cli" -> "cli")
              moduleName = fullModuleName
                .slice(rootModuleName.length)
                .replace(/^-/, "");

              // If nothing is left after stripping, treat as root module
              if (!moduleName) {
                moduleName = undefined;
              }
            }

            console.debug(
              `Processing module: ${moduleName || "root"} (isRoot: ${isRootModule}, original: ${fullModuleName}, rootModule: ${rootModuleName})`,
            );
            
            // make sure we have functions
            if (!moduleObj.asObject.functions) {
              console.warn(
                `Module ${moduleObj.asObject.name} has no functions, skipping`,
              );
              return;
            }

            // Process each function in the module
            moduleObj.asObject.functions.forEach((func: ModuleFunction) => {
              functions.push({
                id: func.id,
                name: func.name,
                description: func.description,
                module: moduleName, // undefined for root module, submodule name for submodules
                returnType: getReturnTypeName(func.returnType),
                args: func.args.map((arg: FunctionArg) => ({
                  name: arg.name,
                  type: getArgumentTypeName(arg.typeDef),
                  required: arg.typeDef.optional !== true,
                })),
              });
            });
          }
        },
      );

      // Always set the cache, even if not enabled.
      // This is to ensure that the cache is always up-to-date if enabled later
      console.debug(`Caching functions for key: ${cacheKey}`);

      this.cache.set(cacheKey, functions);

      return functions;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("Error parsing functions response:", errorMessage);

      throw new Error(`Failed to parse functions response: ${errorMessage}`);
    }
  }

  async getFunctionsAsTree(
    path: string,
  ): Promise<Map<string, Array<{ fn: FunctionInfo; index: number }>>> {
    const functions = await this.getFunctions(path);

    const functionTree: Map<
      string,
      Array<{ fn: FunctionInfo; index: number }>
    > = new Map();

    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      if (!fn.id) {
        console.warn(`Function ${fn.name} has no ID, skipping`);
        continue;
      }

      // Determine the module key for grouping
      // Root module functions (module is undefined) use empty string as key
      // Submodule functions use their module name as key
      const moduleKey = fn.module || "";

      // Initialize the module group if it doesn't exist
      if (!functionTree.has(moduleKey)) {
        functionTree.set(moduleKey, []);
      }

      // Add function to its module group
      functionTree.get(moduleKey)!.push({ fn, index: i });
    }

    return functionTree;
  }

  /**
   * Runs a command using the Dagger CLI.
   *
   * @param args The arguments to pass to the Dagger CLI command.
   * @param options Options for running the command, including working directory, environment variables, and timeout.
   * @returns A promise that resolves to the output of the command execution.
   */
  async run(args: string[], options: RunOptions): Promise<Output> {
    const { cwd, env, timeout = 30_000 } = options;
    const shell = process.env.SHELL;
    if (!shell) {
      console.error("SHELL environment variable is not set.");
      throw new Error("SHELL environment variable is not set.");
    }

    try {
      let stdout = "";
      let stderr = "";

      let child = require("child_process").spawn("dagger", args, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        shell,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // if options.stdin is provided, write it to the child's stdin
      if (options.stdin) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }

      await new Promise((resolve, reject) => {
        child.on("close", (code: number) => {
          if (code !== 0) {
            console.error("GraphQL query failed:", stderr);
            reject(new Error(stderr || `Dagger exited with code ${code}`));
          } else {
            resolve(undefined);
          }
        });
      });

      return {
        exitCode: 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      };
    } catch (error) {
      console.error("Error executing Dagger CLI command:", error);

      const errorStatus =
        error && typeof error === "object" && "status" in error
          ? (error.status as number)
          : 1;
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while executing the command.";

      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }

      return {
        exitCode: errorStatus,
        stdout: "",
        stderr: errorMessage,
      };
    }
  }

  /**
   * Executes a query against the Dagger API.
   *
   * @param query The GraphQL query string.
   * @param variables The variables for the query.
   * @param cwd The current working directory for the command execution.
   * @returns A promise that resolves to the output of the query execution.
   */
  async execQuery(
    query: string,
    variables: Record<string, any>,
    cwd: string,
  ): Promise<Output> {
    const vars = Object.entries(variables)
      .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
      .join(" ");
    const { stdout, stderr, exitCode } = await this.run(
      ["query", "--var", vars],
      { cwd, stdin: query },
    );

    return {
      exitCode,
      stdout,
      stderr,
    };
  }

  /**
   * Checks if the specified path is a Dagger project.
   *
   * @param path The path to check.
   * @returns A promise that resolves to true if the path is a Dagger project, false otherwise.
   */
  async isDaggerProject(path: string): Promise<boolean> {
    try {
      // is the dagger.json file present?
      return fs.existsSync(`${path}/dagger.json`);
    } catch (error) {
      console.error("Error checking Dagger project:", error);
      return false;
    }
  }

  /**
   * Retrieves the directory ID for the specified path.
   * This method executes a GraphQL query to fetch the directory ID.
   *
   * @param path The path to the directory.
   * @returns A promise that resolves to the directory ID as a string.
   */
  private async getDirectoryID(path: string): Promise<string> {
    const cacheKey = this.cache.generateKey("directory", path);
    // if (this.settings.enableCache) {
    //   const cachedResult = await this.cache.get<DirectoryIdResult>(cacheKey);
    //   if (cachedResult) {
    //     console.debug(`Using cached directory ID for key: ${cacheKey}`);

    //     return cachedResult.host.directory.id;
    //   }
    // }

    const { stdout, stderr, exitCode } = await this.execQuery(
      queryHostDirectory,
      { path: path },
      path, // pass the path because the cli command needs to come from the same path
    );

    if (exitCode !== 0) {
      throw new Error(`Failed to get directory ID: ${stderr}`);
    }

    // convert stdout to DirectoryIdResult type
    let result: DirectoryIdResult;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse directory ID result: ${errorMessage}`);
    }

    console.debug(`Caching directory ID for key: ${cacheKey}`);

    // always set the cache, even if not enabled. This is to ensure that the cache is always up-to-date if enabled later
    this.cache.set(cacheKey, result);

    return result.host.directory.id;
  }
}

export const slugify = (text: string): string => {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
};

export const kebab = (text: string): string => {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/_/g, "-")
    .replace(/\.|,/g, "-");
};
