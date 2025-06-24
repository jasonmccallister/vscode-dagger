import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success?: boolean;
}

type Function = {
    name: string;
    description?: string;
};

type FunctionArgument = {
    name: string;
    type: string;
    required: boolean;
};

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
        options: { timeout?: number; cwd?: string } = {}
    ): Promise<CommandResult> {
        const timeout = options.timeout || 30000;
        const command = `${this.command} ${args.join(' ')}`;

        try {
            if (options.cwd && !fs.existsSync(options.cwd)) {
                throw new Error(`Working directory does not exist: ${options.cwd}`);
            }

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
        progressTitle: string = 'Dagger: Running command',
        progressMessage?: string
    ): Promise<CommandResult> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        }, async (progress) => {
            if (progressMessage) {
                progress.report({ message: progressMessage });
            }
            return await this.run(args, options);
        });
    }

    public async functionsList(path: string): Promise<Function[]> {
        const result = await this.run(['functions'], { cwd: path });
        if (!result.success) {
            throw new Error(`Failed to list functions: ${result.stderr}`);
        }

        if (!result.stdout) {
            return [];
        }

        const lines = result.stdout.split('\n').map(line => line.trim());
        const headerIdx = lines.findIndex(line => line.toLowerCase().includes('name') && line.toLowerCase().includes('description'));
        let functions: Function[] = [];
        if (headerIdx !== -1) {
            functions = lines.slice(headerIdx + 1)
                .filter(line => line && !/^[-▶]/.test(line))
                .map(line => {
                    // Split by 2+ spaces
                    const [name, ...descParts] = line.split(/\s{2,}/);
                    return { name: name.trim(), description: descParts.join(' ').trim() };
                })
                .filter(fn => fn.name);
        }

        return functions;
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

    /**
     * Gets the arguments for a given Dagger function by parsing the output of `dagger call <function-name> -h`
     * @param fnName The function name
     * @returns Array of argument objects: { name, type, required }
     */
    public async getFunctionArguments(name: string, path: string): Promise<FunctionArgument[]> {
        const result = await this.run(['call', name, '-h'], { cwd: path });
        if (!result.success) {
            throw new Error(`Failed to get arguments for function '${name}': ${result.stderr}`);
        }

        const lines = result.stdout.split('\n').map(line => line.trim());
        const argsStart = lines.findIndex(line => line.includes('\x1b[1mARGUMENTS\x1b'));
        if (argsStart === -1) {
            return [];
        }

        const args: FunctionArgument[] = [];
        for (let i = argsStart + 1; i < lines.length; i++) {
            const line = lines[i];
            console.log(`Parsing line: ${line}`);
            // Stop at next section (all uppercase, min 2 chars) or empty line
            if (!line || (/^[A-Z][A-Z0-9 \-]+$/.test(line) && line.length > 2)) {
                break;
            }
            // Match: --arg-name [type]   [required] or --arg-name type   [required]
            const match = line.match(/^--([a-zA-Z0-9-_]+)\s+(\[?[a-zA-Z0-9-_]+\]?)(?:\s+\[required\])?/);
            if (match) {
                args.push({
                    name: match[1],
                    type: match[2].replace(/\[|\]/g, ''),
                    required: /\[required\]/.test(line)
                });
            }
        }
        return args;
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

