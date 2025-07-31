import * as vscode from "vscode";
import { DaggerCLI } from "../cli";

interface SdkOption {
  readonly label: string;
  readonly value: string;
}

type FunctionsChoice = "Yes" | "No";

export const COMMAND = "dagger.init";

const SDK_OPTIONS: readonly SdkOption[] = [
  { label: "Go", value: "go" },
  { label: "TypeScript", value: "typescript" },
  { label: "PHP", value: "php" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
] as const;

export const registerInitCommand = (
  context: vscode.ExtensionContext,
  daggerCli: DaggerCLI,
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    // Select SDK for new project
    const sdkChoice = await vscode.window.showQuickPick(SDK_OPTIONS, {
      placeHolder: "Select the SDK to use",
    });

    if (!sdkChoice) {
      // User cancelled the selection
      return;
    }

    await initializeProject(daggerCli, sdkChoice);
  });

  context.subscriptions.push(disposable);
};

/**
 * Gets the current workspace directory
 * @returns The workspace directory path
 */
const getWorkspaceDirectory = (): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : process.cwd();
};

/**
 * Initializes a new Dagger project with selected SDK
 * @param cli The Dagger CLI instance
 * @param sdk The selected SDK option
 * @returns Promise that resolves when initialization is complete
 */
const initializeProject = async (
  daggerCli: DaggerCLI,
  sdk: SdkOption,
): Promise<void> => {
  try {
    const cwd = getWorkspaceDirectory();
    const result = await daggerCli.run(["init", "--sdk", sdk.value], { cwd });

    if (result.exitCode !== 0) {
      vscode.window.showErrorMessage(
        `Failed to initialize Dagger project: ${result.stderr}`,
      );

      return;
    }

    // Ask the user if they want to see available functions
    const choice = (await vscode.window.showInformationMessage(
      `Dagger project initialized with ${sdk.label} SDK! Would you like to see the available functions?`,
      { modal: true },
      "Yes",
      "No",
    )) as FunctionsChoice | undefined;

    if (choice === "Yes") {
      await vscode.commands.executeCommand("dagger.functions");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to initialize Dagger project: ${errorMessage}`,
    );
  }
};
