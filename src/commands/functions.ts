import * as vscode from 'vscode';
import Cli from '../cli';
import { askToInstall } from '../actions/install';
import { initProjectCommand } from '../actions/init';
import Terminal from '../terminal';

export default function functionsCommand(context: vscode.ExtensionContext, cli: Cli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.functions', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            // check if this workspace is already a dagger project
            if (!await cli.isDaggerProject()) {
                initProjectCommand();

                return;
            }

            Terminal.run(
                vscode.workspace.getConfiguration('dagger'),
                ['functions'],
            );
        }),
    );
}