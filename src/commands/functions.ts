import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { initProjectCommand } from '../actions/init';
import { VIEW_FUNCTIONS_COMMAND } from './view-functions';

export const registerFunctionsCommand = (
    context: vscode.ExtensionContext,
    cli: Cli
): void => {
    const disposable = vscode.commands.registerCommand('dagger.functions', async () => {
        // Check if this workspace is already a dagger project
        if (!(await cli.isDaggerProject())) {
            await initProjectCommand();
            return;
        }

        // Open the tree view to show functions instead of running terminal command
        await vscode.commands.executeCommand(VIEW_FUNCTIONS_COMMAND);
    });

    context.subscriptions.push(disposable);
};