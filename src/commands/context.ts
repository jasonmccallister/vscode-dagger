import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { DaggerSettings } from "../settings";
import { Command } from "./types";

export class ContextDirectoryCommand implements Command {
  constructor(
    private _dagger: DaggerCLI,
    private path: string,
    private settings: DaggerSettings,
  ) {}

  execute = async (): Promise<void> => {
    vscode.window.showInformationMessage(
      `Setting context directory is: ${this.settings.contextDirectory}`,
    );

    // find all subdirectories at the given path
    const subdirs = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(this.path),
    );

    let daggerDirectories: string[] = [];

    // check if they have a dagger.json file
    for (const [name, type] of subdirs) {
      if (type === vscode.FileType.Directory) {
        const hasDaggerFile = await this.checkForDaggerFile(name);
        if (hasDaggerFile) {
          daggerDirectories.push(name);
        }
      }
    }

    if (daggerDirectories.length === 0) {
      vscode.window.showWarningMessage(
        `No dagger.json files found in subdirectories of: ${this.path}`,
      );
    }

    // show a quick pick
    const selected = await vscode.window.showQuickPick(daggerDirectories, {
      placeHolder: "Select the Context Directory",
      canPickMany: false,
    });

    if (!selected) {
      vscode.window.showWarningMessage("No Context Directory selected.");
      return;
    }

    this.settings.update(
      "contextDirectory",
      selected,
      vscode.ConfigurationTarget.Workspace,
    );

    vscode.window.showInformationMessage(
      `Context directory set to: ${selected}`,
    );
  };

  private async checkForDaggerFile(subdirName: string): Promise<boolean> {
    const dirPath = vscode.Uri.file(`${this.path}/${subdirName}/dagger.json`);
    try {
      await vscode.workspace.fs.stat(dirPath);
      return true;
    } catch (err) {
      return false;
    }
  }
}
