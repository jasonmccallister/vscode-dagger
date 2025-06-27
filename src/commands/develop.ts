import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { initProjectCommand } from '../actions/init';
import { executeInTerminal } from '../utils/terminal';

export const registerDevelopCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand('dagger.develop', async () => {
        if (!(await cli.isDaggerProject())) {
            await initProjectCommand();
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Running `dagger develop`...' });

            executeInTerminal('dagger develop', workspacePath);
        });
    });

    context.subscriptions.push(disposable);
};