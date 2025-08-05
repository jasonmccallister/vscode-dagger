import * as vscode from "vscode";
import { Command } from "./types";

export class ReloadFunctionsCommand implements Command {
  constructor(private reloadCallback: () => void) {}

  public execute = async (): Promise<void> => {
    try {
      this.reloadCallback();
      vscode.window.showInformationMessage("Functions reloaded successfully.");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reload functions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
