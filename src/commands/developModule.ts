import * as vscode from "vscode";
import { CollectedFunctionInput, runFunction } from "../utils";
import { DaggerCLI } from "../cli";

export const registerDevelopCommand = (
  context: vscode.ExtensionContext,
  _daggerCli: DaggerCLI,
  workspace: string,
): void => {
  const disposable = vscode.commands.registerCommand(
    "dagger.develop",
    async () => {
      await vscode.window
        .withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Dagger",
            cancellable: true,
          },
          async (_progress, token) => {
            // Run the Dagger development environment setup
            const output = await runFunction(token, workspace, {
              functionName: "",
              moduleName: "",
              returnType: "",
              isParentModule: false,
              argValues: {},
              commandArgs: ["dagger", "develop"],
            } as CollectedFunctionInput);

            if (token.isCancellationRequested) {
              console.log(
                "Dagger development environment setup cancelled by user",
              );
              
              return undefined;
            }

            if (!output) {
              console.error("Failed to start Dagger development environment");
              vscode.window.showErrorMessage(
                "Failed to start Dagger development environment",
              );
              return undefined;
            }

            if (!output.Result.success) {
              console.error("Failed to start Dagger development environment");
              vscode.window.showErrorMessage(
                "Failed to start Dagger development environment",
              );
              return undefined;
            }
          },
        )
        .then(
          () => {
            vscode.window.showInformationMessage(
              "Dagger development environment started successfully.",
            );
          },
          (error) => {
            console.error(
              "Failed to start Dagger development environment",
              error,
            );
            vscode.window.showErrorMessage(
              `Failed to start Dagger development environment: ${error.message}`,
            );
          },
        );
    },
  );

  context.subscriptions.push(disposable);
};
