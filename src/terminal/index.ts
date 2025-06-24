import * as vscode from 'vscode';
import * as path from 'path';

const windowName = 'Dagger';

class Terminal {
    public static run(
        config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
        commands: string[],
        forceShow: boolean = false,
    ): vscode.Terminal {
        let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === windowName);
        if (!terminal) {
            // Get the extension context to access the extension path
            const extensionPath = vscode.extensions.getExtension('jasonmccallister.vscode-dagger')?.extensionPath;
            const iconPath = extensionPath ? 
                vscode.Uri.file(path.join(extensionPath, 'images', 'dagger.png')) : 
                new vscode.ThemeIcon('symbol-misc'); // Fallback icon

            terminal = vscode.window.createTerminal({
                name: windowName,
                iconPath: iconPath
            });
        }

        const shouldExecute = config.get<boolean>('autoExecute', true);
        if (shouldExecute === false || forceShow) {
            terminal.show(true);
        }

        // add dagger as the first command if not already present
        if (commands[0] !== 'dagger') {
            commands.unshift('dagger');
        }

        // Always prefix with 'dagger call' when using the terminal
        terminal.sendText(commands.join(' '), config.get('autoExecute', shouldExecute));

        return terminal;
    }
}

export default Terminal;