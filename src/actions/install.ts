import * as vscode from 'vscode';

type InstallChoice = 'Yes' | 'No';

export const askToInstall = async (): Promise<void> => {
    const install = await vscode.window.showInformationMessage(
        'Dagger is not installed. Would you like to install it now?',
        'Yes',
        'No'
    ) as InstallChoice | undefined;

    if (install === 'Yes') {
        await vscode.commands.executeCommand('dagger.install');
        return;
    }

    vscode.window.showInformationMessage('You can install Dagger later by running the "Dagger: Install" command.');
};
