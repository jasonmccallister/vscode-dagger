import * as vscode from 'vscode';
import DaggerCli from '../cli';

export class ShellCommand {
    static register(
        context: vscode.ExtensionContext,
        workspacePath: string,
        cli: DaggerCli,
    ): void {
        cli.setWorkspacePath(workspacePath);

        context.subscriptions.push(
            vscode.commands.registerCommand('dagger.shell', async () => {
                await this.run(cli);
            })
        );
    }

    private static async run(cli: DaggerCli) {
        if (!(await cli.isInstalled())) {
            vscode.window.showErrorMessage('Dagger is not installed. Please install Dagger to use this command.');
            return;
        }

        if (!(await cli.isDaggerProject())) {
            vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
            return;
        }

        const terminal = vscode.window.createTerminal({
            name: 'Dagger',
        });

        terminal.show();
        terminal.sendText('dagger shell', true);
    }
}