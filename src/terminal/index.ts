import * as vscode from 'vscode';
import * as path from 'path';

const windowName = 'Dagger';

class Terminal {
    public static run(
        config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
        commands: string[],
    ): vscode.Terminal {
        let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === windowName);

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

        terminal.sendText(commands.join(' '), config.get('autoExecute', true));
    }
}

export default Terminal;