import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * A CLI wrapper for executing Dagger commands within a VS Code workspace
 */
export default class DaggerCli {
    private readonly workspace: vscode.Uri;
    private readonly command: string;

    /**
     * Creates a new DaggerCli instance
     * @param command Path to the dagger executable (e.g., 'dagger' or '/usr/local/bin/dagger')
     * @param workspace VS Code workspace folder to execute commands in
     */
    constructor(
        command: string,
        workspace: vscode.Uri,
    ) {
        if (!command || command.trim().length === 0) {
            throw new Error('Command path cannot be empty');
        }

        if (!workspace) {
            throw new Error('Workspace cannot be null or undefined');
        }

        this.command = command.trim();
        this.workspace = workspace;
    }

    public async run(
        args: string[] = [],
        options: { timeout?: number; cwd?: string } = {}
    ): Promise<CommandResult> {
        const workingDirectory = options.cwd || this.workspace.fsPath;
        const timeout = options.timeout || 30000;

        if (!fs.existsSync(workingDirectory)) {
            throw new Error(`Working directory does not exist: ${workingDirectory}`);
        }

        const command = `${this.command} ${args.join(' ')}`;

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: workingDirectory,
                timeout,
                env: process.env
            });

            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0
            };
        } catch (error: any) {
            return {
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || error.message || 'Unknown error',
                exitCode: error.code || 1
            };
        }
    }

    /**
     * Checks if a dagger.json file exists in the workspace
     */
    public async isDaggerProject(): Promise<boolean> {
        const workspacePath = this.workspace.fsPath;
        const daggerJsonPath = path.join(workspacePath, 'dagger.json');
        return fs.existsSync(daggerJsonPath);
    }
}

