import * as vscode from 'vscode';
import Cli from '../../dagger/dagger';
import { initProjectCommand } from '../../actions/init';
import { collectAndRunFunction, showSaveTaskPrompt } from '../../utils/function-helpers';
import type { Item } from '../../tree/provider';

const COMMAND = 'dagger.call';

interface FunctionQuickPickItem {
    readonly label: string;
    readonly description: string;
}

export const registerCallCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async (preSelectedFunctionOrItem?: string | Item) => {
        if (!(await cli.isDaggerProject())) { return initProjectCommand(); }

        const workspacePathForCli = getWorkspacePath(workspacePath);

        // Ensure CLI has the workspace path set
        cli.setWorkspacePath(workspacePathForCli);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Loading functions...' });

            console.log(`Call command - workspace path: ${workspacePathForCli}, preSelected: ${preSelectedFunctionOrItem}`);

            let selectedFunction: string;

            // Handle different types of input - string or tree item object
            let preSelectedFunction: string | undefined;
            if (typeof preSelectedFunctionOrItem === 'string') {
                preSelectedFunction = preSelectedFunctionOrItem;
            } else if (preSelectedFunctionOrItem && preSelectedFunctionOrItem.id && typeof preSelectedFunctionOrItem.id === 'string') {
                // Tree item was passed - extract the function name from the id property
                preSelectedFunction = preSelectedFunctionOrItem.id;
                console.log(`Function selected from tree: ${preSelectedFunction}`);
            }

            // Use pre-selected function if provided, otherwise show picker
            if (preSelectedFunction) {
                selectedFunction = preSelectedFunction;
            } else {
                const result = await selectFunction(cli, workspacePathForCli);
                if (!result) {
                    return;
                }
                selectedFunction = result;
            }

            progress.report({ message: 'Getting function arguments...' });

            // get the selected function arguments - use the CLI workspace path consistently
            try {
                const args = await cli.getFunctionArguments(selectedFunction, workspacePathForCli);
                if (!args) {
                    vscode.window.showErrorMessage(`Failed to get arguments for function '${selectedFunction}' - no arguments returned`);
                    return;
                }

                // show prompting for input progress
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
 * @returns The selected function name or undefined if cancelled
 */
const selectFunction = async (cli: Cli, workspacePath: string): Promise<string | undefined> => {
    const functions = await cli.functionsList(workspacePath);

    if (functions.length === 0) {
        vscode.window.showInformationMessage('No Dagger functions found in this project.');
        return undefined;
    }

    const functionItems: readonly FunctionQuickPickItem[] = functions.map(fn => ({
        label: fn.name,
        description: fn.description ?? ''
    }));

    const pick = await vscode.window.showQuickPick(functionItems, {
        placeHolder: 'Select a function to call'
    });

    return pick?.label;
};


