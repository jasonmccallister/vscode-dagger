import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { initProjectCommand } from '../actions/init';
import { executeInTerminal } from '../utils/terminal';

export const registerDevelopCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    _workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand('dagger.develop', async () => {
        if (!(await cli.isDaggerProject())) {
            await initProjectCommand();
            return;
        }

        executeInTerminal('dagger develop');
    });

    context.subscriptions.push(disposable);
};