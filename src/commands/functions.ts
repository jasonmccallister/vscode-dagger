import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install';
import { Terminal } from '../terminal';
import { initProjectCommand } from '../actions/init';

export default function functionsCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
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

            // Open a terminal and run the dagger functions command
            Terminal.run(
                vscode.workspace.getConfiguration('dagger'),
                ['functions'],
            );
        }),
    );
}