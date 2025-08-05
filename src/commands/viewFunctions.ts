import * as vscode from "vscode";
import { Command } from "./types";

export class DaggerViewFunctions implements Command {
  execute = async (): Promise<void> => {
    // call the refresh command to ensure the tree view is up-to-date in the background
    vscode.commands.executeCommand("dagger.reloadFunctions");

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
  };
}