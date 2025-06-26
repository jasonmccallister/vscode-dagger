import * as vscode from 'vscode';

export const VIEW_FUNCTIONS_COMMAND = 'dagger.viewFunctions';

const TREE_VIEW_ID = 'daggerTreeView';

export const registerViewFunctionsCommand = (context: vscode.ExtensionContext): void => {
    const disposable = vscode.commands.registerCommand(VIEW_FUNCTIONS_COMMAND, async () => {
        await vscode.commands.executeCommand('workbench.view.extension.daggerViewContainer');
        // call the refresh command to ensure the tree view is up-to-date in the background
        await vscode.commands.executeCommand('dagger.refresh');

        // Focus on the tree view specifically
        await vscode.commands.executeCommand(`${TREE_VIEW_ID}.focus`);
    });

    context.subscriptions.push(disposable);
};
