import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install';
import Terminal from '../terminal';
import { initProjectCommand } from '../actions/init';

export default function developCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
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