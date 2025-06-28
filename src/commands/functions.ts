import * as vscode from 'vscode';

export const VIEW_FUNCTIONS_COMMAND = 'dagger.functions';

export const registerFunctionsCommand = (context: vscode.ExtensionContext): void => {
    const disposable = vscode.commands.registerCommand(VIEW_FUNCTIONS_COMMAND, async () => {
        await vscode.commands.executeCommand('workbench.view.extension.daggerViewContainer');
        // call the refresh command to ensure the tree view is up-to-date in the background
        vscode.commands.executeCommand('dagger.refresh');

        // Focus on the tree view specifically without calling a command
        const treeView = vscode.window.visibleTextEditors.find(editor => editor.document.uri.scheme === 'dagger');
        if (treeView) {
            treeView.show();
        }
    });

    context.subscriptions.push(disposable);
};
