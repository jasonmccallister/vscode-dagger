import * as vscode from "vscode";
import { DaggerCLI } from "../cli";

export const registerVersionCommand = (
  context: vscode.ExtensionContext,
  daggerCli: DaggerCLI,
  workspace: string,
): void => {
  context.subscriptions.push(vscode.commands.registerCommand(
    "dagger.version",
    async (): Promise<void> => {
      const progressOptions = {
        title: "Dagger",
        location: vscode.ProgressLocation.Notification,
      };

      await vscode.window.withProgress(progressOptions, async (progress) => {
        progress.report({ message: "Getting Dagger version..." });
        
        const result = await daggerCli.run(["version"], {
          cwd: workspace,
        });

        if (!result || result.exitCode !== 0) {
          vscode.window.showErrorMessage(
            `Failed to get Dagger version: ${result.stderr}`,
          );

          return;
        }

        // Show the version in an information message
        vscode.window.showInformationMessage(
          `Dagger Version: ${result.stdout}`,
        );
      });
   }));
};
