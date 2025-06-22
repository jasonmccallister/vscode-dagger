import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install-prompt';

export default function functionsCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.functions', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            // check if this workspace is already a dagger project
            if (!await cli.isDaggerProject()) {
                const choice = await vscode.window.showErrorMessage(
                    `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
                    { modal: true },
                    'Run Init',
                    'No'
                );

                if (choice === 'Run Init') {
                    // Open a terminal and run the dagger init command
                    const terminal = vscode.window.createTerminal('Dagger');
                    terminal.sendText('dagger init');
                    terminal.show();
                }

                return;
            }

            // Open a terminal and run the dagger functions command
            const terminal = vscode.window.createTerminal('Dagger');
            terminal.sendText('dagger functions');
            terminal.show();
        }),
    );
}