import * as vscode from 'vscode';

export const EXPAND_ALL_COMMAND = 'dagger.expand';

export const registerExpandCommand = (
    context: vscode.ExtensionContext, 
    getTreeView: () => vscode.TreeView<any> | undefined,
    getDataProvider: () => any
): void => {
    const disposable = vscode.commands.registerCommand(EXPAND_ALL_COMMAND, async () => {
        const treeView = getTreeView();
        const dataProvider = getDataProvider();
        
        if (!treeView || !dataProvider) {
            vscode.window.showWarningMessage('Tree view not available');
            return;
        }

        try {
            // Get all top-level items from the data provider
            const topLevelItems = dataProvider.getChildren(); // No element = top level items
            
            // Expand each top-level item and its children (up to 3 levels as per VS Code limitation)
            for (const item of topLevelItems) {
                await treeView.reveal(item, { 
                    select: false, 
                    focus: false, 
                    expand: 3 
                });
            }
        } catch (error) {
            console.error('Failed to expand tree items:', error);
            vscode.window.showErrorMessage('Failed to expand tree items');
        }
    });
    
    context.subscriptions.push(disposable);
};
