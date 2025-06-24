import * as vscode from 'vscode';

export async function askToInstall() {
    const install = await vscode.window.showInformationMessage(
        'Dagger is not installed. Would you like to install it now?',
        'Yes',
        'No'
    );

    if (install === 'Yes') {
        vscode.commands.executeCommand('dagger.install');
        return;
    }

    vscode.window.showInformationMessage('You can install Dagger later by running the "Dagger: Install" command.');
}
