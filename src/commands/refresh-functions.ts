import * as vscode from 'vscode';

export const REFRESH_FUNCTIONS_COMMAND = 'dagger.refreshFunctions';

export const registerRefreshFunctionsCommand = (
    context: vscode.ExtensionContext,
    refreshCallback: () => void
): void => {
    const disposable = vscode.commands.registerCommand(REFRESH_FUNCTIONS_COMMAND, refreshCallback);
    context.subscriptions.push(disposable);
};
