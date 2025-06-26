import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import { initProjectCommand } from '../actions/init';
import Terminal from '../terminal';

export default function functionsCommand(context: vscode.ExtensionContext, cli: Cli): void {
    const disposable = vscode.commands.registerCommand('dagger.functions', async () => {
        if (!await cli.isInstalled()) {
            await askToInstall();
            return;
        }

        // check if this workspace is already a dagger project
        if (!await cli.isDaggerProject()) {
            await initProjectCommand();
            return;
        }

        Terminal.run(
            vscode.workspace.getConfiguration('dagger'),
            ['functions'],
        );
    });

    context.subscriptions.push(disposable);
}