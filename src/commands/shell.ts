import * as vscode from 'vscode';
import * as path from 'path';

export const registerShellCommand = (
    context: vscode.ExtensionContext,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand('dagger.shell', async () => {
        // open a terminal with the command `dagger shell`
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Opening Dagger shell...' });

            // Execute the command in the terminal
            const terminal = vscode.window.createTerminal({
                name: 'Dagger',
                iconPath: vscode.Uri.file(path.join(context.extensionPath, 'images', 'icon-white.png')),
                cwd: workspacePath
            });
            terminal.show();
            terminal.sendText('dagger shell');
        });
    });

    context.subscriptions.push(disposable);
};