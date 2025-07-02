import * as vscode from 'vscode';
import Cli from '../../dagger';
import { showProjectSetupPrompt } from '../../prompt';
import { collectAndRunFunction, showSaveTaskPrompt } from '../../utils/function-helpers';
import { DaggerTreeItem } from '../../tree/provider';

export const COMMAND = 'dagger.call';

interface FunctionQuickPickItem extends vscode.QuickPickItem {
    readonly label: string;
    readonly description: string;
    readonly functionId?: string;
}

interface SelectedFunction {
    name: string;
    functionId?: string;
}

export const registerCallCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async (preSelectedFunction?: string | DaggerTreeItem) => {
        if (!(await cli.isDaggerProject())) { return showProjectSetupPrompt(); }

        const workspacePathForCli = getWorkspacePath(workspacePath);

        // Ensure CLI has the workspace path set
        cli.setWorkspacePath(workspacePathForCli);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Loading functions...' });

            console.log(`Call command - workspace path: ${workspacePathForCli}, preSelected: ${preSelectedFunction}`);

            let selectedFunction: string;
            let functionId: string | undefined;

            // Handle different types of input - string or tree item object
            if (typeof preSelectedFunction === 'string') {
                // String function name was passed
                selectedFunction = preSelectedFunction;
            } else if (preSelectedFunction && typeof preSelectedFunction === 'object') {
                // Tree item was passed
                const treeItem = preSelectedFunction;

                // Use the functionId property directly if available
                if (treeItem.functionId) {
                    functionId = treeItem.functionId;
                    selectedFunction = treeItem.originalName;
                    console.log(`Function selected from tree with ID: ${functionId}`);
                } else {
                    // Fallback to using the name
                    selectedFunction = treeItem.originalName;
                    console.log(`Function selected from tree by name: ${selectedFunction}`);
                }
            } else {
                // No function was pre-selected, show picker
                const result = await selectFunction(cli, workspacePathForCli);
                if (!result) {
                    return;
                }
                selectedFunction = result.name;
                functionId = result.functionId;
            }

            progress.report({ message: 'Getting function arguments...' });

            try {
                let args;

                // If we have a function ID, use the direct query method
                if (functionId) {
                    progress.report({ message: `Loading function '${selectedFunction}' using ID...` });
                    const functionInfo = await cli.queryFunctionByID(functionId, workspacePathForCli);

                    if (!functionInfo) {
                        vscode.window.showErrorMessage(`Failed to get details for function '${selectedFunction}' with ID ${functionId}`);
                        return;
                    }

                    args = functionInfo.args;
                } else {
                    // Fallback to the name-based lookup
                    args = await cli.getFunctionArgsByName(selectedFunction, workspacePathForCli);
                }

                if (!args) {
                    vscode.window.showErrorMessage(`Failed to get arguments for function '${selectedFunction}' - no arguments returned`);
                    return;
                }

                // Show prompting for input progress
                progress.report({ message: `Collecting input for function '${selectedFunction}'...` });

                // Use the shared helper to collect arguments and run the function
                const { success, argValues } = await collectAndRunFunction(context, selectedFunction, args);
                if (success) {
                    await showSaveTaskPrompt(selectedFunction, argValues, workspacePathForCli);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to get arguments for function '${selectedFunction}': ${errorMessage}`);
                console.error('Error getting function arguments:', error);
                return;
            }
        });
    });

    context.subscriptions.push(disposable);
};

/**
 * Gets the workspace path, falling back to current working directory
 * @param workspace The initial workspace path
 * @returns The resolved workspace path
 */
const getWorkspacePath = (workspace: string): string => {
    if (workspace) {
        return workspace;
    }

    console.log('No workspace path set. Using current workspace or cwd.');
    const workspaceFolders = vscode.workspace.workspaceFolders;

    return workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].uri.fsPath
        : process.cwd();
};

/**
 * Loads functions and shows quick pick for selection
 * @param cli The Dagger CLI instance
 * @param workspacePath The workspace path
 * @returns The selected function details or undefined if cancelled
 */
const selectFunction = async (cli: Cli, workspacePath: string): Promise<SelectedFunction | undefined> => {
    const functions = await cli.functionsList(workspacePath);

    if (functions.length === 0) {
        vscode.window.showInformationMessage('No Dagger functions found in this project.');
        return undefined;
    }

    const functionItems: FunctionQuickPickItem[] = functions.map(fn => ({
        label: fn.name,
        description: fn.description ?? '',
        functionId: fn.functionId
    }));

    const pick = await vscode.window.showQuickPick(functionItems, {
        placeHolder: 'Select a function to call'
    });

    if (!pick) {
        return undefined;
    }

    return {
        name: pick.label,
        functionId: pick.functionId
    };
};


