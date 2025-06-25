import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import Terminal from '../terminal';
import { initProjectCommand } from '../actions/init';

export default function developCommand(context: vscode.ExtensionContext, cli: Cli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.develop', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            if (!await cli.isDaggerProject()) {
                initProjectCommand();

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
        })
    );
}