import * as vscode from "vscode";

export const registerReloadFunctionsCommand = (
  context: vscode.ExtensionContext,
  reloadCallback: () => void,
): void => {
  const disposable = vscode.commands.registerCommand(
    "dagger.reloadFunctions",
    reloadCallback,
  );
  context.subscriptions.push(disposable);
};
