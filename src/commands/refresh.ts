import * as vscode from 'vscode';

export const REFRESH_COMMAND = 'dagger.refresh';

export const registerRefreshFunctionsCommand = (
    context: vscode.ExtensionContext,
    refreshCallback: () => void
): void => {
    const disposable = vscode.commands.registerCommand(REFRESH_COMMAND, refreshCallback);
    context.subscriptions.push(disposable);
};
