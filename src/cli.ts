import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success?: boolean;
}

export default class DaggerCli {
    private command: string = 'dagger';
    private workspacePath?: string;

    /**
     * Runs the Dagger command with the specified arguments and options
     * @param args Arguments to pass to the command
     * @param options Options for running the command, such as timeout and working directory
     * @returns A Promise that resolves to a CommandResult containing stdout, stderr, and exit code
     * @throws Error if the command fails to execute or the working directory does not exist
     */
    public async run(
        args: string[] = [],
        options: { timeout?: number; cwd?: string; progress?: typeof import('vscode').window } = {}
    ): Promise<CommandResult> {
        const timeout = options.timeout || 30000;
        const command = `${this.command} ${args.join(' ')}`;
        const progressApi = options.progress || (typeof vscode !== 'undefined' ? vscode.window : undefined);
        if (progressApi) {
            return await progressApi.withProgress({
                title: `Dagger: ${command}`,
                location: vscode.ProgressLocation.Notification
            }, async () => {
                try {
                    const stdout = execSync(command, {
                        cwd: options.cwd || this.workspacePath || process.cwd(),
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
            });
        } else {
            try {
                const stdout = execSync(command, {
                    cwd: options.cwd || this.workspacePath || process.cwd(),
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
    }

    /**
     * Validates if the Dagger command is available in the system
     * @returns A Promise that resolves to true if the command is available, false otherwise
     */
    public async isInstalled(): Promise<boolean> {
        const result = await this.run(['version']);
        if (result.stdout !== '' && result.stdout.includes('dagger')) {
            return true;
        }

        return false;
    }

    public async isDaggerProject(): Promise<boolean> {
        let projectRoot = this.workspacePath;
        if (!projectRoot) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                projectRoot = workspaceFolders[0].uri.fsPath;
            } else {
                projectRoot = process.cwd();
            }
        }
        try {
            const stats = await fs.promises.stat(path.join(projectRoot, 'dagger.json'));
            return stats.isFile();
        } catch (error) {
            return false; // If dagger.json file does not exist, return false
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

