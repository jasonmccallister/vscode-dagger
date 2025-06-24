import * as vscode from 'vscode';

export async function initProjectCommand() {
    // Ask the user if they want to run the functions command
    const choice = await vscode.window.showErrorMessage(
        `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
        { modal: true },
        'Run Init',
        'No'
    );

    if (choice === 'Run Init') {
        vscode.commands.executeCommand('dagger.init');
    }
}