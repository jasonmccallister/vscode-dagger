import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { Command } from "./types";

interface SdkOption {
  readonly label: string;
  readonly value: string;
}

type FunctionsChoice = "Yes" | "No";

const SDK_OPTIONS: readonly SdkOption[] = [
  { label: "Go", value: "go" },
  { label: "TypeScript", value: "typescript" },
  { label: "PHP", value: "php" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
] as const;

export class InitCommand implements Command {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
  ) {}

  execute = async (_input?: void | undefined): Promise<void> => {
    const sdkChoice = await vscode.window.showQuickPick(SDK_OPTIONS, {
      placeHolder: "Select the SDK to use",
    });

    if (!sdkChoice) {
      // User cancelled the selection
      return;
    }

    try {
      const result = await this.dagger.run(["init", "--sdk", sdkChoice.value], {
        cwd: this.path,
      });

      if (result.exitCode !== 0) {
        vscode.window.showErrorMessage(
          `Failed to initialize Dagger project: ${result.stderr}`,
        );

        return;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Failed to initialize Dagger project: ${errorMessage}`,
      );
    }

    this.postExecute();
  };

  postExecute = async (): Promise<void> => {
    // Ask the user if they want to see available functions
    const choice = (await vscode.window.showInformationMessage(
      `Dagger project initialized. Would you like to see the available functions?`,
      { modal: true },
      "Yes",
      "No",
    )) as FunctionsChoice | undefined;

    if (choice === "Yes") {
      await vscode.commands.executeCommand("dagger.functions");
    }
  };
}
