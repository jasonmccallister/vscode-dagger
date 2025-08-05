import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { Command } from "./types";

export class DaggerVersionCommand implements Command {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
  ) {}

  execute = async (): Promise<void> => {
    const progressOptions = {
      title: "Dagger",
      location: vscode.ProgressLocation.Notification,
    };

    await vscode.window.withProgress(progressOptions, async (progress) => {
      progress.report({ message: "Getting Dagger version..." });

      const result = await this.dagger.run(["version"], {
        cwd: this.path,
      });

      if (!result || result.exitCode !== 0) {
        vscode.window.showErrorMessage(
          `Failed to get Dagger version: ${result.stderr}`,
        );
        return;
      }

      // Show the version in an information message
      vscode.window.showInformationMessage(`Dagger Version: ${result.stdout}`);
    });
  };
}
