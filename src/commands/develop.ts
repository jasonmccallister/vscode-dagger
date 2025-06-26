import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import Terminal from '../terminal';
import { initProjectCommand } from '../actions/init';

export const registerDevelopCommand = (context: vscode.ExtensionContext): void => {
    const cli = new Cli();
    
    const disposable = vscode.commands.registerCommand('dagger.develop', async () => {
        if (!await cli.isInstalled()) {
            await askToInstall();
            return;
        }

        if (!await cli.isDaggerProject()) {
            await initProjectCommand();
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger: Running develop',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Running `dagger develop`...' });

            Terminal.run(
                vscode.workspace.getConfiguration('dagger'),
                ['develop'],
            );
        });
    });

    context.subscriptions.push(disposable);
};