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
     * Runs a Dagger command with a VS Code progress window
     * @param args Arguments to pass to the command
     * @param options Options for running the command, such as timeout and working directory
     * @param progressTitle Title for the progress window
     * @param progressMessage Optional message to show during execution
     * @returns A Promise that resolves to a CommandResult
     */
    public async runWithProgress(
        args: string[] = [],
        options: { timeout?: number; cwd?: string } = {},
        progressMessage?: string
    ): Promise<CommandResult> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            if (progressMessage) {
                progress.report({ message: progressMessage });
            }
            return await this.run(args, options);
        });
    }

    public async functionsList(workspacePath: string): Promise<FunctionInfo[]> {
        const id = await this.queryDirectoryId(workspacePath);
        if (!id) {
            return [];
        }

        const objects = await this.queryModuleFunctions(id, workspacePath);
        if (!objects || objects.length === 0) {
            return [];
        }

        const functions: FunctionInfo[] = [];
        for (const obj of objects) {
            if (obj.asObject) {
                for (const func of obj.asObject.functions) {
                    functions.push({
                        name: this.camelCaseToKebabCase(func.name),
                        description: func.description,
                        args: func.args.map(arg => {
                            // Primary method: Use the optional property if available
                            // Fallback: Check description for [required] if optional property is not set
                            const isRequired = arg.typeDef.optional === undefined 
                                ? arg.description?.includes('[required]') || false
                                : !arg.typeDef.optional;
                                
                            return {
                                name: this.camelCaseToKebabCase(arg.name),
                                type: arg.typeDef.kind,
                                required: isRequired
                            };
                        })
                    });
                }
            }
        }

        return functions;
    }

    private camelCaseToKebabCase(str: string): string {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
            .toLowerCase();
    }

    /**
     * Validates if the Dagger command is available in the system
     */
    public async isInstalled(): Promise<boolean> {
        const result = await this.run(['version']);
        return result.stdout !== '' && result.stdout.includes('dagger');
    }

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
     * Retrieves the list of functions available in the Dagger module for the given workspace path.
     * @param workspacePath The path to the Dagger project directory
     * @returns A Promise that resolves to an array of FunctionInfo objects
     */
    public async getFunctions(workspacePath: string): Promise<ModuleObject[]> {
        try {
            const id = await this.queryDirectoryId(workspacePath);
            if (!id) {
                throw new Error(`No directory ID found for workspace path: ${workspacePath}`);
            }

            const objects = await this.queryModuleFunctions(id, workspacePath);
            return objects.filter(obj => obj.asObject !== undefined);
        } catch (error: any) {
            console.error(`Error getting functions: ${error.message}`);
            throw error;
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
    async queryDirectoryId(workspacePath: string): Promise<string | undefined> {
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

    async queryModuleFunctions(directoryId: string, workspacePath: string): Promise<ModuleObject[]> {
        const query = `
            query($id: DirectoryID!) {
              loadDirectoryFromID(id: $id) {
                asModule {
                  name
                  objects {
                    asObject {
                      name
                      functions {
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
}

