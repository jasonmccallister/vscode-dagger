import * as vscode from 'vscode';
import { SAVE_TASK_COMMAND } from './save-task';

export const SAVE_TASK_FROM_TREE_COMMAND = 'dagger.saveTaskFromTree';

export const registerSaveTaskFromTreeCommand = (
    context: vscode.ExtensionContext
): void => {
    const disposable = vscode.commands.registerCommand(SAVE_TASK_FROM_TREE_COMMAND, async (treeItem: any) => {
        // Extract function name from tree item
        const functionName = treeItem?.id || treeItem?.label;
        
        if (!functionName) {
            vscode.window.showErrorMessage('Unable to determine function name from tree item');
            return;
        }

        // Execute the main save task command with the function name
        await vscode.commands.executeCommand(SAVE_TASK_COMMAND, functionName);
    });

    context.subscriptions.push(disposable);
};
