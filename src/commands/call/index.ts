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
    readonly moduleName?: string;
}

interface SelectedFunction {
    name: string;
    functionId?: string;
    moduleName?: string;
}

export const registerCallCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async (input?: DaggerTreeItem | string) => {
        if (!(await cli.isDaggerProject())) { return showProjectSetupPrompt(); }

        // Ensure CLI has the workspace path set
        cli.setWorkspacePath(workspacePath);

        // Debug logging
        console.log(`Call command invoked with input:`, input);
        console.log(`Input type: ${typeof input}`);
        console.log(`Input instanceof DaggerTreeItem: ${input instanceof DaggerTreeItem}`);
        if (input instanceof DaggerTreeItem) {
            console.log(`DaggerTreeItem properties:`, {
                originalName: input.originalName,
                functionId: input.functionId,
                moduleName: input.moduleName
            });
        }

        let functionName: string | undefined;
        let functionId: string | undefined;
        let moduleName: string | undefined;
        let functionInfo;

        // Determine function selection method
        if (input instanceof DaggerTreeItem && input.functionId) {
            // Case 1: Function selected from tree view
            functionId = input.functionId;
            functionName = input.originalName;
            moduleName = input.moduleName;
            console.log(`Function selected from tree with ID: ${functionId}, Name: ${functionName}, Module: ${moduleName || 'default'}`);
        } else if (typeof input === 'string') {
            // Case 2: Function ID passed as string
            functionId = input;
            console.log(`Function selected by ID: ${functionId}`);
        } else {
            // Case 3: No input - show function picker
            console.log('No function input provided, showing function picker');
            const result = await selectFunction(cli, workspacePath);

            if (!result) {
                return; // Selection cancelled
            }

            functionName = result.name;
            functionId = result.functionId;
            moduleName = result.moduleName;
            console.log(`Function selected from picker: ${functionName}`);
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Getting function arguments...' });

            try {
                // Get function details from the Dagger CLI
                if (functionId) {
                    progress.report({ message: 'Loading function using ID...' });

                    // Use the new getFunction method if available, otherwise fall back to queryFunctionByID
                    if (typeof cli.getFunction === 'function') {
                        functionInfo = await cli.getFunction(functionId, workspacePath);
                    } else {
                        functionInfo = await cli.queryFunctionByID(functionId, workspacePath);
                    }

                    if (!functionInfo) {
                        vscode.window.showErrorMessage(`Failed to get details for function with ID ${functionId}`);
                        return;
                    }

                    // Set properties from function info
                    functionName = functionInfo.name;
                    moduleName = functionInfo.module;
                } else {
                    vscode.window.showErrorMessage('No function selected');
                    return;
                }

                if (!functionInfo || !functionInfo.args) {
                    vscode.window.showErrorMessage(`Failed to get arguments for function - no arguments returned`);
                    return;
                }

                // Show prompting for input progress
                progress.report({ message: `Collecting input for function '${functionName}'...` });

                // Use the shared helper to collect arguments and run the function
                const { success, argValues } = await collectAndRunFunction(
                    context,
                    functionName!,
                    functionInfo.args,
                    moduleName // Pass module name to determine command format
                );

                if (success) {
                    await showSaveTaskPrompt(functionName!, argValues, workspacePath);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to get function details: ${errorMessage}`);
                console.error('Error in call command:', error);
                return;
            }
        });
    });

    context.subscriptions.push(disposable);
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
        functionId: fn.functionId,
        moduleName: fn.module
    }));

    const pick = await vscode.window.showQuickPick(functionItems, {
        placeHolder: 'Select a function to call'
    });

    if (!pick) {
        return undefined;
    }

    return {
        name: pick.label,
        functionId: pick.functionId,
        moduleName: pick.moduleName
    };
};
