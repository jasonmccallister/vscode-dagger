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

const MESSAGES = {
    TERMINAL_BUSY: 'The terminal appears to be busy. Do you want to interrupt the current process?',
    INTERRUPT_PROCESS: 'Interrupt Process',
    CANCEL: 'Cancel'
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
        terminalOptions.iconPath = vscode.Uri.file(path.join(extensionPath, 'images', 'dagger-white.png'));
    }
    
    const newTerminal = vscode.window.createTerminal(terminalOptions);
    
    return { terminal: newTerminal, isNewlyCreated: true };
};

/**
 * Checks if a terminal appears to be busy by examining its shell integration state
 */
export const isTerminalBusy = (terminal: vscode.Terminal): boolean => {
    // VS Code's shell integration provides state information
    const shellIntegration = terminal.shellIntegration;
    
    if (shellIntegration) {
        // Check if there's an active command execution
        // The cwd property changes when a command is running vs when it's at prompt
        // Also check if there are any active executions
        const hasActiveExecution = shellIntegration.executeCommand !== undefined;
        
        // Additional check: see if we can access the current working directory
        // This is a more reliable indicator than executeCommand
        try {
            // If we can get the CWD and there's no active execution, terminal is likely ready
            return hasActiveExecution && shellIntegration.cwd !== undefined;
        } catch {
            // If we can't determine state, assume it's not busy for new terminals
            return false;
        }
    }
    
    // If no shell integration, we can't reliably detect busy state
    // For new terminals or terminals without integration, assume they're ready
    return false;
};

/**
 * Handles interrupting a busy terminal process
 */
export const handleBusyTerminal = async (terminal: vscode.Terminal): Promise<boolean> => {
    const action = await vscode.window.showWarningMessage(
        MESSAGES.TERMINAL_BUSY,
        { modal: true },
        MESSAGES.INTERRUPT_PROCESS,
        MESSAGES.CANCEL
    );
    
    if (action === MESSAGES.INTERRUPT_PROCESS) {
        // Clear any running processes and reset terminal to clean state
        
        // 1. Send Ctrl+C multiple times to ensure any process is interrupted
        terminal.sendText(TERMINAL_CONFIG.CTRL_C, false);
        await new Promise(resolve => setTimeout(resolve, 100));
        terminal.sendText(TERMINAL_CONFIG.CTRL_C, false);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 2. Clear the current line input
        terminal.sendText(TERMINAL_CONFIG.CLEAR_LINE, false);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 3. Send exit command to get back to shell if in a sub-process
        terminal.sendText(TERMINAL_CONFIG.EXIT_COMMAND);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 4. Clear the screen for a clean start
        terminal.sendText('clear');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return true;
    }
    
    return false; // User cancelled
};

/**
 * Executes a command in the Dagger terminal, handling busy states appropriately
 */
export const executeInTerminal = async (command: string, extensionPath?: string): Promise<void> => {
    const { terminal, isNewlyCreated } = findOrCreateTerminal(extensionPath);

    // Check if terminal is busy (only for existing terminals, not newly created ones)
    if (!isNewlyCreated && isTerminalBusy(terminal)) {
        const shouldProceed = await handleBusyTerminal(terminal);
        if (!shouldProceed) {
            return; // User cancelled
        }
    }
    
    // Send the command to the terminal
    terminal.sendText(command);
    
    // Show the terminal
    terminal.show();
};
