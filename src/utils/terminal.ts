import * as vscode from 'vscode';
import * as path from 'path';
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from '../const';

const TERMINAL_CONFIG = {
    NAME: 'Dagger',
    SHELL_INTEGRATION_TIMEOUT: 2000, // 2 seconds to check if terminal is busy
    CTRL_C: '\x03', // Control+C character
    CLEAR_SCREEN: '\x0c', // Form feed to clear screen
    CLEAR_LINE: '\x15', // NAK to clear current line
    EXIT_COMMAND: 'exit'
} as const;

/**
 * Executes a command in the Dagger terminal
 */
export const executeInTerminal = async (command: string): Promise<void> => {
    // Read user setting for running function calls in background
    const config = vscode.workspace.getConfiguration('dagger');
    const runInBackground = config.get<boolean>('functionCalls.runInBackground', true);
    const taskExecution = new vscode.ShellExecution(command);
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
    };

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
        vscode.window.showInformationMessage(
            `${command}`,
            'View Output'
        ).then(selection => {
            if (selection === 'View Output') {
                const daggerTerminal = vscode.window.terminals.find(t => t.name === TERMINAL_CONFIG.NAME);
                if (daggerTerminal) {
                    daggerTerminal.show();
                    return;
                }

                // Get extension path for icons
                const extension = vscode.extensions.getExtension('jasonmccallister.vscode-dagger');
                const extensionPath = extension?.extensionPath;

                const newTerminal = vscode.window.createTerminal({
                    name: TERMINAL_CONFIG.NAME,
                    iconPath: extensionPath ? {
                        light: vscode.Uri.file(path.join(extensionPath, ICON_PATH_BLACK)),
                        dark: vscode.Uri.file(path.join(extensionPath, ICON_PATH_WHITE))
                    } : undefined
                });
                newTerminal.show();
                newTerminal.sendText(command);
            }
        });
    }, (error) => {
        console.error(`Failed to execute command in terminal: ${command}`, error);
        vscode.window.showErrorMessage(`Failed to execute command: ${error.message}`);
    });
};
