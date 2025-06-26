import * as vscode from 'vscode';

type InitChoice = 'Run Init' | 'No';

export const initProjectCommand = async (): Promise<void> => {
    // Ask the user if they want to run the init command
    const choice = await vscode.window.showErrorMessage(
        `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
        { modal: true },
        'Run Init',
        'No'
    ) as InitChoice | undefined;

    if (choice === 'Run Init') {
        await vscode.commands.executeCommand('dagger.init');
    }
};