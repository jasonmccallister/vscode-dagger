import * as vscode from 'vscode';
import * as path from 'path';

const WINDOW_NAME = 'Dagger' as const;

interface TerminalConfiguration {
    readonly autoExecute?: boolean;
}

class Terminal {
    public static run(
        config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
        commands: readonly string[],
    ): vscode.Terminal {
        let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === WINDOW_NAME);

        if (!terminal) {
            terminal = vscode.window.createTerminal({
                name: WINDOW_NAME,
                iconPath: this.getIconPath()
            });
        }

        this.executeCommand(terminal, commands, config);

        terminal.show(true);

        return terminal;
    }

    private static getIconPath(): vscode.Uri | vscode.ThemeIcon {
        // Try to find the extension by name first
        const possibleExtensionIds = ['vscode-dagger', 'jasonmccallister.vscode-dagger'] as const;
        
        for (const extensionId of possibleExtensionIds) {
            const extension = vscode.extensions.getExtension(extensionId);
            if (extension?.extensionPath) {
                return vscode.Uri.file(path.join(extension.extensionPath, 'images', 'dagger-white.png'));
            }
        }

        // If not found, try to find by display name
        const extension = vscode.extensions.all.find(ext =>
            ext.packageJSON.name === 'vscode-dagger' ||
            ext.packageJSON.displayName === 'vscode-dagger'
        );

        return extension?.extensionPath ?
            vscode.Uri.file(path.join(extension.extensionPath, 'images', 'dagger-white.png')) :
            new vscode.ThemeIcon('symbol-misc');
    }

    private static executeCommand(
        terminal: vscode.Terminal,
        commands: readonly string[],
        config: vscode.WorkspaceConfiguration
    ): void {
        // add dagger as the first command if not already present
        const commandsArray = [...commands];
        if (commandsArray[0] !== 'dagger') {
            commandsArray.unshift('dagger');
        }

        const autoExecute = config.get<boolean>('autoExecute', true);
        terminal.sendText(commandsArray.join(' '), autoExecute);
    }
}

export default Terminal;