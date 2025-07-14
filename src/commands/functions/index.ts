import * as vscode from "vscode";
import { COMMAND as REFRESH_COMMAND } from "../refresh";

export const COMMAND = "dagger.functions";

export const registerFunctionsCommand = (
  context: vscode.ExtensionContext,
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    // call the refresh command to ensure the tree view is up-to-date in the background
    vscode.commands.executeCommand(REFRESH_COMMAND);

    await vscode.commands.executeCommand(
      "workbench.view.extension.daggerViewContainer",
    );

    // Focus on the tree view specifically without calling a command
    const treeView = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.scheme === "dagger",
    );
    if (treeView) {
      treeView.show();
    }
  });

  context.subscriptions.push(disposable);
};
