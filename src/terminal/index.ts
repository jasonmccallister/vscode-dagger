import * as vscode from 'vscode';
import * as path from 'path';

const windowName = 'Dagger';
let isTerminalBusy = false;
let isShellCommand = false;

class Terminal {
    public static run(
        config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
        commands: string[],
    ): vscode.Terminal {
        let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === windowName);

        // Check if terminal exists and is busy
        if (terminal && isTerminalBusy) {
            vscode.window.showWarningMessage(
                'Dagger terminal is busy running a command. Please wait for it to complete or stop the current terminal.',
                'Wait', 'Stop Terminal'
            ).then(selection => {
                if (selection === 'Stop Terminal' && terminal) {
                    // Clear the terminal and reset busy state
                    // if its a shell command, we need to interrupt it with ctrl+d
                    if (isShellCommand) {
                        // For shell commands, we need to send Ctrl+D to interrupt
                        terminal.sendText('\x04'); // Send Ctrl+D to interrupt current command
                    } else {
                        terminal.sendText('\x03'); // Send Ctrl+C to interrupt current command
                    }
                    setTimeout(() => {
                        // Clear the terminal screen after a brief delay
                        terminal!.sendText('clear', true);
                        isTerminalBusy = false;

                        // Now execute our command
                        this.executeCommand(terminal!, commands, config);

                        terminal!.show(true);
                    }, 500); // 500ms delay to allow interrupt to process
                }
            });

            return terminal;
        }

        if (!terminal) {
            terminal = vscode.window.createTerminal({
                name: windowName,
                iconPath: this.getIconPath()
            });
        }

        this.executeCommand(terminal, commands, config);

        terminal.show(true);

        return terminal;
    }

    private static getIconPath(): vscode.Uri | vscode.ThemeIcon {
        // Try to find the extension by name first
        let extensionPath = vscode.extensions.getExtension('vscode-dagger')?.extensionPath;

        // If not found, try with a potential publisher prefix
        if (!extensionPath) {
            extensionPath = vscode.extensions.getExtension('jasonmccallister.vscode-dagger')?.extensionPath;
        }

        // If still not found, try to find by display name
        if (!extensionPath) {
            const extension = vscode.extensions.all.find(ext =>
                ext.packageJSON.name === 'vscode-dagger' ||
                ext.packageJSON.displayName === 'vscode-dagger'
            );
            extensionPath = extension?.extensionPath;
        }

        return extensionPath ?
            vscode.Uri.file(path.join(extensionPath, 'images', 'dagger-white.png')) :
            new vscode.ThemeIcon('symbol-misc');
    }

    private static executeCommand(
        terminal: vscode.Terminal,
        commands: string[],
        config: vscode.WorkspaceConfiguration
    ): void {
        // add dagger as the first command if not already present
        if (commands[0] !== 'dagger') {
            commands.unshift('dagger');
        }

        // Mark terminal as busy before executing
        isTerminalBusy = true;

        // is the command dagger shell?
        isShellCommand = commands[0] === 'dagger' && commands[1] === 'shell';

        // Set up a listener to detect when command finishes
        // This is a workaround since VS Code doesn't provide direct busy state
        const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal.name === windowName || closedTerminal.name?.startsWith(windowName)) {
                isTerminalBusy = false;
                disposable.dispose();
            }
        });

        // Also reset busy state after a reasonable timeout
        setTimeout(() => {
            isTerminalBusy = false;
        }, 30000); // 30 seconds timeout

        terminal.sendText(commands.join(' '), config.get('autoExecute', true));
    }
}

export default Terminal;