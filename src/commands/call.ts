import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install-prompt';

export default function callCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.call', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            if (!(await cli.isDaggerProject())) {
                vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
                return;
            }

        })
    );
}