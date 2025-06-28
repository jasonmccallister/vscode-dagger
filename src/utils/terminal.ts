import * as vscode from 'vscode';
import * as path from 'path';

const TERMINAL_CONFIG = {
    NAME: 'Dagger',
    SHELL_INTEGRATION_TIMEOUT: 2000, // 2 seconds to check if terminal is busy
    CTRL_C: '\x03', // Control+C character
    CLEAR_SCREEN: '\x0c', // Form feed to clear screen
    CLEAR_LINE: '\x15', // NAK to clear current line
    EXIT_COMMAND: 'exit'
} as const;

interface TerminalResult {
    terminal: vscode.Terminal;
    isNewlyCreated: boolean;
}

/**
 * Executes a command in the Dagger terminal
 */
export const executeInTerminal = async (command: string): Promise<void> => {
    runCommandAsTask(command);
};

/**
 * Finds an existing terminal or creates a new one
 * Returns both the terminal and whether it was newly created
 */
const findOrCreateTerminal = (extensionPath: string): TerminalResult => {
    // Look for existing terminal
    const existingTerminal = vscode.window.terminals.find(
        terminal => terminal.name === TERMINAL_CONFIG.NAME
    );

    if (existingTerminal) {
        return { terminal: existingTerminal, isNewlyCreated: false };
    }

    // Create new terminal if none exists
    const terminalOptions: vscode.TerminalOptions = {
        name: TERMINAL_CONFIG.NAME,
        shellPath: undefined, // Use default shell
        shellArgs: undefined
    };

    // Add icon if extension path is available
    if (extensionPath) {
        terminalOptions.iconPath = vscode.Uri.file(path.join(extensionPath, 'images', 'icon-white.png'));
    }

    const newTerminal = vscode.window.createTerminal(terminalOptions);

    return { terminal: newTerminal, isNewlyCreated: true };
};


/**
 * Runs a command as a task using the same terminal/task window name (e.g., "Dagger")
 */
const runCommandAsTask = async (command: string): Promise<void> => {
    // Read user setting for running function calls in background
    const config = vscode.workspace.getConfiguration('dagger');
    const runInBackground = config.get<boolean>('functionCalls.runInBackground', true);

    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
    };

    const taskExecution = new vscode.ShellExecution(command);

    const task = new vscode.Task(
        taskDefinition,
        vscode.TaskScope.Workspace,
        TERMINAL_CONFIG.NAME,
        'shell',
        taskExecution
    );

    task.presentationOptions = {
        reveal: runInBackground ? vscode.TaskRevealKind.Silent : vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Shared,
        showReuseMessage: false,
        clear: false
    };
    task.detail = command;
    task.isBackground = runInBackground;

    vscode.tasks.executeTask(task).then(() => {
        vscode.window.showInformationMessage(`Command executed: ${command}`);
    }, (error) => {
        console.error(`Failed to execute command in terminal: ${command}`, error);
        vscode.window.showErrorMessage(`Failed to execute command: ${error.message}`);
    });
};
