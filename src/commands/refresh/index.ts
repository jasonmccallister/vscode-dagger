import * as vscode from "vscode";

export const COMMAND = "dagger.refresh";

export const registerRefreshFunctionsCommand = (
  context: vscode.ExtensionContext,
  refreshCallback: () => void,
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, refreshCallback);
  context.subscriptions.push(disposable);
};
