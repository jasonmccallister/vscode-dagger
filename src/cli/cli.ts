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
    private readonly workspace: vscode.WorkspaceFolder;
    private readonly commandPath: string;

    /**
     * Creates a new DaggerCli instance
     * @param commandPath Path to the dagger executable (e.g., 'dagger' or '/usr/local/bin/dagger')
     * @param workspace VS Code workspace folder to execute commands in
     */
    constructor(
        commandPath: string,
        workspace: vscode.WorkspaceFolder,
    ) {
        if (!commandPath || commandPath.trim().length === 0) {
            throw new Error('Command path cannot be empty');
        }
        
        if (!workspace) {
            throw new Error('Workspace folder is required');
        }

        this.commandPath = commandPath.trim();
        this.workspace = workspace;
    }

    /**
     * Creates a DaggerCli instance with validation
     * @param commandPath Path to the dagger executable
     * @param workspace VS Code workspace folder
     * @returns Promise that resolves to a DaggerCli instance if valid
     */
    public static async create(
        commandPath: string,
        workspace: vscode.WorkspaceFolder
    ): Promise<DaggerCli> {
        const cli = new DaggerCli(commandPath, workspace);
        await cli.validateCommand();
        return cli;
    }

    /**
     * Validates that the command exists and is executable
     */
    public async validateCommand(): Promise<void> {
        try {
            // Try to run the command with --version to check if it exists and is working
            await this.runCommand(['version'], { timeout: 5000 });
        } catch (error) {
            throw new Error(`Failed to validate command '${this.commandPath}': ${error}`);
        }
    }

    /**
     * Executes a dagger command with the given arguments
     * @param args Command arguments to pass to dagger
     * @param options Execution options
     * @returns Promise that resolves to command output
     */
    public async runCommand(
        args: string[] = [], 
        options: { timeout?: number; cwd?: string } = {}
    ): Promise<string> {
        const workingDirectory = options.cwd || this.workspace.uri.fsPath;
        const timeout = options.timeout || 30000; // 30 second default timeout
        
        // Validate working directory exists
        if (!fs.existsSync(workingDirectory)) {
            throw new Error(`Working directory does not exist: ${workingDirectory}`);
        }

        const command = `${this.commandPath} ${args.join(' ')}`;
        
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: workingDirectory,
                timeout,
                env: {
                    ...process.env,
                    // Ensure we have a clean environment for the command
                }
            });

            // Log the command execution for debugging
            console.log(`Executed: ${command} in ${workingDirectory}`);
            
            if (stderr && stderr.trim().length > 0) {
                console.warn(`Command stderr: ${stderr}`);
            }

            return stdout.trim();
        } catch (error: any) {
            const errorMessage = error.stderr || error.message || 'Unknown error occurred';
            throw new Error(`Command '${command}' failed: ${errorMessage}`);
        }
    }

    /**
     * Executes a dagger command and returns detailed result information
     * @param args Command arguments to pass to dagger
     * @param options Execution options
     * @returns Promise that resolves to detailed command result
     */
    public async runCommandDetailed(
        args: string[] = [],
        options: { timeout?: number; cwd?: string } = {}
    ): Promise<CommandResult> {
        const workingDirectory = options.cwd || this.workspace.uri.fsPath;
        const timeout = options.timeout || 30000;
        
        if (!fs.existsSync(workingDirectory)) {
            throw new Error(`Working directory does not exist: ${workingDirectory}`);
        }

        const command = `${this.commandPath} ${args.join(' ')}`;
        
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
     * Gets the workspace folder this CLI instance is associated with
     */
    public getWorkspace(): vscode.WorkspaceFolder {
        return this.workspace;
    }

    /**
     * Gets the command path this CLI instance uses
     */
    public getCommandPath(): string {
        return this.commandPath;
    }

    /**
     * Checks if a dagger.json file exists in the workspace
     */
    public async isDaggerProject(): Promise<boolean> {
        const workspacePath = this.workspace.uri.fsPath;
        const daggerJsonPath = path.join(workspacePath, 'dagger.json');
        return fs.existsSync(daggerJsonPath);
    }

    /**
     * Initializes a new Dagger project in the workspace
     * @param sdk The SDK to use (go, typescript, python, java, php)
     * @param name Optional project name (defaults to workspace folder name)
     * @returns Promise that resolves to the command output
     */
    public async initProject(sdk: string, name?: string): Promise<string> {
        const args = ['init'];
        
        // Add SDK flag
        if (sdk) {
            args.push('--sdk', sdk);
        }
        
        // Add name flag if provided, otherwise use workspace folder name
        const projectName = name || path.basename(this.workspace.uri.fsPath);
        if (projectName) {
            args.push('--name', projectName);
        }

        return this.runCommand(args);
    }
}

