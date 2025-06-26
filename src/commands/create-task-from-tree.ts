import * as vscode from 'vscode';
import { getDataProvider } from '../tree/provider';
import { CREATE_TASK_COMMAND } from './create-task';

export const CREATE_TASK_FROM_TREE_COMMAND = 'dagger.createTaskFromTree';

export const registerCreateTaskFromTreeCommand = (
    context: vscode.ExtensionContext
): void => {
    const disposable = vscode.commands.registerCommand(CREATE_TASK_FROM_TREE_COMMAND, async (treeItem: any) => {
        // Extract function name from tree item
        const functionName = treeItem?.id || treeItem?.label;
        
        if (!functionName) {
            vscode.window.showErrorMessage('Unable to determine function name from tree item');
            return;
        }

        // Execute the main create task command with the function name
        await vscode.commands.executeCommand(CREATE_TASK_COMMAND, functionName);
    });

    context.subscriptions.push(disposable);
};
