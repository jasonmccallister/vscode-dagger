import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DirectoryIdResult, ModuleObject, ModuleResult } from './types';

export interface CommandResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
    readonly success?: boolean;
}

export interface FunctionInfo {
    readonly name: string;
    readonly description?: string;
    readonly args?: FunctionArgument[];
    readonly functionId?: string; // Unique identifier for the function from GraphQL
    readonly module?: string; // Module name for grouping functions
}

export interface FunctionArgument {
    readonly name: string;
    readonly type: string;
    readonly required: boolean;
}

interface RunOptions {
    readonly timeout?: number;
    readonly cwd?: string;
}

export default class Cli {
    private readonly command = 'dagger';
    private workspacePath?: string;

    /**
     * Runs the Dagger command with the specified arguments and options
     */
    public async run(
        args: string[] = [],
        options: RunOptions = {}
    ): Promise<CommandResult> {
        const { timeout = 30_000, cwd } = options;
        const command = `${this.command} ${args.join(' ')}`;

        try {
            if (cwd && !fs.existsSync(cwd)) {
                throw new Error(`Working directory does not exist: ${cwd}`);
            }

            const stdout = execSync(command, {
                cwd: cwd ?? this.workspacePath ?? process.cwd(),
                timeout,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            return {
                stdout: stdout.toString().trim(),
                stderr: '',
                exitCode: 0,
                success: true
            };
        } catch (error: any) {
            return {
                stdout: error.stdout?.toString().trim() || '',
                stderr: error.stderr?.toString().trim() || error.message || 'Unknown error',
                exitCode: error.status || 1,
                success: false
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
        let functions: FunctionInfo[] = [];
        try {
            const id = await this.queryDirectoryId(workspacePath);
            if (!id) {
                console.warn(`Failed to get directory ID for workspace: ${workspacePath}`);
                return [];
            }

            const objects = await this.queryModuleFunctions(id, workspacePath);
            if (!objects || objects.length === 0) {
                console.warn(`No functions found in Dagger module for workspace: ${workspacePath}`);
                return [];
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
                const moduleName = obj.asObject.name || obj.name || 'default';

                for (const func of obj.asObject.functions) {
                    // Format the full name and extract module context
                    const kebabName = this.camelCaseToKebabCase(func.name);
                    
                    functions.push({
                        name: kebabName,
                        description: func.description,
                        functionId: func.id,
                        module: moduleName, // Set explicit module name from the object
                        args: func.args.map(arg => {
                            // Primary method: Use the optional property if available
                            // Fallback: Check description for [required] if optional property is not set
                            const isRequired = arg.typeDef.optional === undefined
                                ? arg.description?.includes('[required]') || false
                                : !arg.typeDef.optional;

                            return {
                                name: this.camelCaseToKebabCase(arg.name),
                                type: this.getFriendlyTypeName(arg.typeDef.kind),
                                required: isRequired
                            };
                        })
                    });
                }
            }
        } catch (error: any) {
            console.error('Error retrieving functions from Dagger module:', error);
            throw new Error(`Failed to retrieve functions from Dagger module: ${error.message}`);
        }

        return functions;
    }

    /**
     * Validates if the Dagger command is available in the system
     */
    public async isInstalled(): Promise<boolean> {
        const result = await this.run(['version']);
        return result.stdout !== '' && result.stdout.includes('dagger');
    }

    /**
     * Checks if the current workspace is a Dagger project by looking for dagger.json
     * @returns A Promise that resolves to true if dagger.json exists, false otherwise
     */
    public async isDaggerProject(): Promise<boolean> {
        const projectRoot = this.workspacePath ??
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
            process.cwd();

        try {
            const stats = await fs.promises.stat(path.join(projectRoot, 'dagger.json'));
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
    public async queryDirectoryId(workspacePath: string): Promise<string | undefined> {
        const query = `
            query($path: String!) {
                host {
                    directory(path: $path) {
                        id
                    }
                }
            }
        `;

        const result = (await this.query(query, { path: workspacePath }, workspacePath)) as DirectoryIdResult;

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
    public async queryModuleFunctions(directoryId: string, workspacePath: string): Promise<ModuleObject[]> {
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
        const result = (await this.query(query, { id: directoryId }, workspacePath)) as ModuleResult;
        // Return the objects array directly, filtering out any null or undefined entries
        return result?.loadDirectoryFromID?.asModule?.objects
            ?.filter(Boolean) ?? [];
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
     * Gets the arguments for a specific function by name from the current project.
     * @param functionName The name of the function to get arguments for (in kebab-case)
     * @param workspacePath The path to the workspace directory (optional if workspacePath is already set)
     * @returns A Promise that resolves to an array of function arguments or undefined if not found
     */
    public async getFunctionArgsByName(
        functionName: string,
        workspacePath?: string
    ): Promise<FunctionArgument[] | undefined> {
        try {
            const path = workspacePath || this.workspacePath;
            if (!path) {
                throw new Error('Workspace path is not set. Please provide a workspace path.');
            }

            // Get all functions from the module
            const functions = await this.functionsList(path);

            // Find the function with the matching name
            const targetFunction = functions.find(
                fn => fn.name.toLowerCase() === functionName.toLowerCase()
            );

            // Return the arguments if found, undefined otherwise
            return targetFunction?.args;
        } catch (error: any) {
            console.error(`Error getting arguments for function ${functionName}:`, error);
            throw new Error(`Failed to get arguments for function '${functionName}': ${error.message}`);
        }
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
        workspacePath: string
    ): Promise<FunctionInfo | undefined> {
        try {
            const query = `
                query($id: FunctionID!) {
                    loadFunctionFromID(id: $id) {
                        id
                        name
                        description
                        parent {
                            ... on Object {
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

            const result = await this.query(query, { id: functionId }, workspacePath);
            const func = (result as any)?.loadFunctionFromID;
            
            if (!func) {
                console.warn(`Function with ID ${functionId} not found`);
                return undefined;
            }

            // Extract module name from parent object if available
            const moduleName = func.parent?.name || 
                (func.name.includes('.') ? func.name.split('.')[0] : 'default');

            // Convert GraphQL function data to FunctionInfo format
            return {
                name: this.camelCaseToKebabCase(func.name),
                description: func.description,
                functionId: func.id,
                module: moduleName, // Set module name from parent object
                args: func.args.map((arg: any) => {
                    const isRequired = arg.typeDef.optional === undefined
                        ? arg.description?.includes('[required]') || false
                        : !arg.typeDef.optional;

                    return {
                        name: this.camelCaseToKebabCase(arg.name),
                        type: this.getFriendlyTypeName(arg.typeDef.kind),
                        required: isRequired
                    };
                })
            };
        } catch (error: any) {
            console.error(`Error retrieving function with ID ${functionId}:`, error);
            throw new Error(`Failed to retrieve function details: ${error.message}`);
        }
    }

    /**
     * Gets detailed information about a function including its arguments using the function ID.
     * 
     * @param functionId The unique identifier of the function to fetch
     * @param workspacePath The path to the workspace to run the command in
     * @returns A Promise that resolves to a FunctionInfo object or undefined if not found
     */
    public async getFunction(functionId: string, workspacePath: string): Promise<FunctionInfo | undefined> {
        try {
            // Use the existing queryFunctionByID method to get the function data
            const functionInfo = await this.queryFunctionByID(functionId, workspacePath);
            
            if (!functionInfo) {
                console.warn(`Function with ID ${functionId} not found`);
                return undefined;
            }
            
            return functionInfo;
        } catch (error: any) {
            console.error(`Error in getFunction for ID ${functionId}:`, error);
            throw new Error(`Failed to get function details: ${error.message}`);
        }
    }

    /**
     * @param str The string to convert from camelCase to kebab-case
     * @description Converts a camelCase string to kebab-case by inserting hyphens before uppercase letters
     * and converting the entire string to lowercase.
     * @returns The kebab-case version of the input string
     */
    private camelCaseToKebabCase(str: string): string {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
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
            const child = require('child_process').spawn(
                this.command,
                ['query', '--var-json', varJson],
                {
                    cwd: path,
                    env: process.env,
                    stdio: ['pipe', 'pipe', 'pipe']
                }
            );

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            child.stdin.write(query);
            child.stdin.end();

            await new Promise((resolve, reject) => {
                child.on('close', (code: number) => {
                    if (code !== 0) {
                        reject(new Error(stderr || `Dagger exited with code ${code}`));
                    } else {
                        resolve(undefined);
                    }
                });
            });

            return JSON.parse(stdout);
        } catch (error: any) {
            console.error('Error executing GraphQL query:', error);
            console.error('Query:', query);
            console.error('Variables:', varJson);
            console.error('Working directory:', path);
            throw new Error(`Failed to execute GraphQL query: ${error.message || error}`);
        }
    }

    /**
     * Converts GraphQL type names to friendly type names.
     * @param graphQLType The GraphQL type name (e.g., OBJECT_STRING, OBJECT_BOOLEAN)
     * @returns A friendly type name (e.g., string, boolean, object)
     * @private
     */
    private getFriendlyTypeName(graphQLType: string): string {
        // Handle null or undefined
        if (!graphQLType) {
            return 'unknown';
        }

        // Handle common GraphQL type prefixes
        if (graphQLType.startsWith('OBJECT_')) {
            const typeWithoutPrefix = graphQLType.substring(7).toLowerCase();

            // Map specific type names
            switch (typeWithoutPrefix) {
                case 'string':
                    return 'string';
                case 'int':
                case 'integer':
                    return 'number';
                case 'float':
                case 'double':
                    return 'number';
                case 'boolean':
                    return 'boolean';
                case 'object':
                    return 'object';
                case 'array':
                    return 'array';
                case 'list':
                    return 'array';
                case 'map':
                    return 'object';
                case 'void':
                case 'nil':
                case 'null':
                    return 'null';
                default:
                    return typeWithoutPrefix;
            }
        }

        // Handle GraphQL scalar types
        switch (graphQLType.toUpperCase()) {
            case 'STRING':
                return 'string';
            case 'INT':
            case 'INTEGER':
            case 'FLOAT':
                return 'number';
            case 'BOOLEAN':
                return 'boolean';
            case 'ID':
                return 'string';
            default:
                // If we can't map it, just lowercase the original type
                return graphQLType.toLowerCase();
        }
    }
}

