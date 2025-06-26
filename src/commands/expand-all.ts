import * as vscode from 'vscode';

export const EXPAND_ALL_COMMAND = 'dagger.expandAll';

const TREE_VIEW_ID = 'daggerTreeView';

export const registerExpandAllCommand = (context: vscode.ExtensionContext): void => {
    const disposable = vscode.commands.registerCommand(EXPAND_ALL_COMMAND, async () => {
        // Get the tree view and expand all items
        await vscode.commands.executeCommand(`${TREE_VIEW_ID}.expandAll`);
    });
    
    context.subscriptions.push(disposable);
};
