import * as vscode from 'vscode';
import Cli from '../dagger/dagger';

export const registerVersionCommand = (context: vscode.ExtensionContext): void => {
    const cli = new Cli();
    
    const commandHandler = async (): Promise<void> => {
        const progressOptions = { 
            title: 'Dagger', 
            location: vscode.ProgressLocation.Notification 
        };

        await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ message: 'Getting Dagger version...' });
            const result = await cli.run(['version']);
            
            if (!result.success) {
                vscode.window.showErrorMessage(`Failed to get Dagger version: ${result.stderr}`);
                return;
            }

            // Show the version in an information message
            vscode.window.showInformationMessage(`Dagger Version: ${result.stdout}`);
        });
    };

    const disposable = vscode.commands.registerCommand('dagger.version', commandHandler);
    context.subscriptions.push(disposable);
};