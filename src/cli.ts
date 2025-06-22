import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success?: boolean;
}

const execAsync = promisify(exec);

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
            const { stdout, stderr } = await execAsync(command, {
                cwd: options.cwd || this.workspacePath || process.cwd(),
                timeout,
                env: process.env
            });

            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
                success: true
            };
        } catch (error: any) {
            return {
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || error.message || 'Unknown error',
                exitCode: error.code || 1,
                success: false
            };
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
        try {
            const stats = await fs.promises.stat(path.join(process.cwd(), 'dagger.json'));
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

