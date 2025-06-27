import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface CommandResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
    readonly success?: boolean;
}

export interface FunctionInfo {
    readonly name: string;
    readonly description?: string;
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

    public async functionsList(targetPath: string): Promise<FunctionInfo[]> {
        const result = await this.run(['functions'], { cwd: targetPath });
        if (!result.success) {
            throw new Error(`Failed to list functions: ${result.stderr}`);
        }

        if (!result.stdout) {
            return [];
        }

        const lines = result.stdout.split('\n').map(line => line.trim());
        const headerIdx = lines.findIndex(line => 
            line.toLowerCase().includes('name') && line.toLowerCase().includes('description')
        );
        
        if (headerIdx === -1) {
            return [];
        }

        const functions = lines.slice(headerIdx + 1)
            .filter(line => line && !/^[-▶]/.test(line))
            .map(line => {
                // Split by 2+ spaces
                const [name, ...descParts] = line.split(/\s{2,}/);
                const trimmedName = name.trim();
                
                // Debug logging
                console.log(`Parsing function line: "${line}"`);
                console.log(`Extracted name: "${trimmedName}", type: ${typeof trimmedName}`);
                
                return { 
                    name: trimmedName, 
                    description: descParts.join(' ').trim() 
                } satisfies FunctionInfo;
            })
            .filter(fn => fn.name);

        return functions;
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
     * Gets the arguments for a given Dagger function by parsing the output of `dagger call <function-name> -h`
     */
    public async getFunctionArguments(name: string, targetPath: string): Promise<FunctionArgument[]> {
        const result = await this.run(['call', name, '-h'], { cwd: targetPath });
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

