import * as vscode from "vscode";
import { exec } from "child_process";
import { DaggerSettings } from "../settings";
import { Command } from "./types";

export class UninstallDaggerCommand implements Command {
  constructor(private settings: DaggerSettings) {}

  public execute = async (): Promise<void> => {
    const installMethod = this.settings.installMethod;

    const confirmUninstall = await vscode.window.showWarningMessage(
      "Are you sure you want to uninstall Dagger?",
      { modal: true },
      "Yes",
    );

    if (confirmUninstall !== "Yes") {
      return; // User cancelled
    }

    try {
      await this.handleUninstallation(installMethod);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to uninstall Dagger: ${error}`);
    }
  };

  private handleUninstallation = async (
    installMethod: string,
  ): Promise<void> => {
    let command: string;
    let methodLabel: string;
    switch (installMethod) {
      case "brew":
        command = "brew uninstall dagger/tap/dagger";
        methodLabel = "Homebrew";
        break;
      case "curl":
        command = "rm -rf ~/.dagger";
        methodLabel = "curl script";
        break;
      default:
        vscode.window.showErrorMessage(
          "Unknown installation method found in settings. Unable to proceed with uninstallation.",
        );
        return;
    }
    await new Promise<void>((resolve, reject) => {
      exec(command, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    vscode.window.showInformationMessage(
      `Dagger has been uninstalled using ${methodLabel}`,
    );
  };
}
