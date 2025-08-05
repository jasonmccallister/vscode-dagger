import * as vscode from "vscode";
import { CollectedFunctionInput, runFunction } from "../utils";
import { DaggerCLI } from "../cli";
import { Command } from "./types";
import { DaggerSettings } from "../settings";

export class DevelopModuleCommand implements Command {
  constructor(
    private _dagger: DaggerCLI,
    private path: string,
    private _settings: DaggerSettings,
  ) {}

  async execute(_input?: void | undefined): Promise<void> {
    await vscode.window
      .withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Dagger",
          cancellable: true,
        },
        async (_progress, token) => {
          const output = await runFunction(token, this.path, {
            functionName: "",
            moduleName: "",
            returnType: "",
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
  }
}
