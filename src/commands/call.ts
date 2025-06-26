import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import { initProjectCommand } from '../actions/init';
import { collectAndRunFunction } from '../utils/function-helpers';

interface FunctionQuickPickItem {
    readonly label: string;
    readonly description: string;
}

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

export const registerCallCommand = (context: vscode.ExtensionContext): void => {
    const disposable = vscode.commands.registerCommand('dagger.call', async () => {
        const cli = new Cli();
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        
        if (!await cli.isInstalled()) {
            return askToInstall();
        }

        if (!(await cli.isDaggerProject())) {
            return initProjectCommand();
        }

        const workspacePath = getWorkspacePath(workspace);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger: Loading functions',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Running `dagger functions`...' });
            
            const selectedFunction = await selectFunction(cli, workspacePath);
            if (!selectedFunction) {
                return;
            }

            progress.report({ message: 'Select a function to call...' });

            // get the selected function arguments
            const args = await cli.getFunctionArguments(selectedFunction, workspacePath);
            if (!args) {
                vscode.window.showErrorMessage(`Failed to get arguments for function '${selectedFunction}'`);
                return;
            }

            // Use the shared helper to collect arguments and run the function
            await collectAndRunFunction(selectedFunction, args);
        });
    });

    context.subscriptions.push(disposable);
};
