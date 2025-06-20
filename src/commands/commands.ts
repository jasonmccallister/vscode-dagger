import * as vscode from 'vscode';

export class DaggerCommands {
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('dagger.init', async () => {
                await vscode.window.showInformationMessage('Dagger init command executed');
            }),
            vscode.commands.registerCommand('dagger.develop', async () => {
                await vscode.window.showInformationMessage('Dagger develop command executed');
            }),
            vscode.commands.registerCommand('dagger.functions', async () => {
                await vscode.window.showInformationMessage('Dagger functions command executed');
            })
        );
    }
}

export default DaggerCommands;