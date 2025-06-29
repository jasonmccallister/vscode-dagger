import * as vscode from 'vscode';

export const COMMAND = 'dagger.expand';

export const registerExpandCommand = (
    context: vscode.ExtensionContext,
    getTreeView: () => vscode.TreeView<any> | undefined,
    getDataProvider: () => any
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async () => {
        const treeView = getTreeView();
        const dataProvider = getDataProvider();

        if (!treeView || !dataProvider) {
            vscode.window.showWarningMessage('Tree view not available');
            return;
        }

        // make sure the tree view is visible
        if (!treeView.visible) {
            const treeView = vscode.window.visibleTextEditors.find(editor => editor.document.uri.scheme === 'dagger');
            if (treeView) {
                treeView.show();
            }
        }

        try {
            // Get all top-level items from the data provider
            const topLevelItems = await dataProvider.getChildren(); // No element = top level items

            // Expand all top-level items concurrently for better performance
            await Promise.all(
                topLevelItems.map((item: any) =>
                    treeView.reveal(item, {
                        select: false,
                        focus: false,
                        expand: 3
                    })
                )
            );
        } catch (error) {
            console.error('Failed to expand tree items:', error);
            vscode.window.showErrorMessage('Failed to expand tree items');
        }
    });

    context.subscriptions.push(disposable);
};
