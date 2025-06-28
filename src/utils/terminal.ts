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
 * Finds an existing terminal or creates a new one
 * Returns both the terminal and whether it was newly created
 */
export const findOrCreateTerminal = (extensionPath?: string): TerminalResult => {
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
 * Executes a command in the Dagger terminal
 */
export const executeInTerminal = async (command: string, extensionPath?: string): Promise<void> => {
    const { terminal } = findOrCreateTerminal(extensionPath);

    // Send the command to the terminal
    terminal.sendText(command);
    
    // Show the terminal
    terminal.show();
};
