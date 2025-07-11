import * as vscode from "vscode";
import Cli, { FunctionInfo } from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";
import {
  collectAndRunFunction,
  showSaveTaskPrompt,
} from "../../utils/function-helpers";
import { DaggerTreeItem } from "../../tree/provider";
import { DaggerSettings } from "../../settings";

export const COMMAND = "dagger.call";

export const registerCallCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspacePath: string,
  settings: DaggerSettings
): void => {
  const disposable = vscode.commands.registerCommand(
    COMMAND,
    async (input?: DaggerTreeItem) => {
      if (!(await cli.isDaggerProject())) {
        return showProjectSetupPrompt();
      }

      // Ensure CLI has the workspace path set
      cli.setWorkspacePath(workspacePath);

      let functionInfo: FunctionInfo | undefined;

      // No input, prompt user to select a function
      if (input === undefined) {
        // selectFunction now returns the full FunctionInfo object
        functionInfo = await selectFunction(cli, workspacePath);

        if (!functionInfo) {
          return; // Selection cancelled
        }
      }

      // Determine function selection method
      if (input instanceof DaggerTreeItem && input.functionInfo !== undefined) {
        functionInfo = input.functionInfo;
      }

      // we should have a functionInfo at this point
      if (!functionInfo) {
        vscode.window.showErrorMessage(
          "No function selected. Please select a function to call."
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Dagger",
          cancellable: true, // Make the operation cancellable
        },
        async (progress, token) => {
          try {
            // Check if the operation was cancelled
            if (token.isCancellationRequested) {
              console.log("Function call cancelled by user");
              return undefined;
            }

            let functionName: string = functionInfo?.name;
            let moduleName: string = functionInfo?.module;

            progress.report({
              message: `Loading function ${functionName}...`,
            });

            // Check if the operation was cancelled
            if (token.isCancellationRequested) {
              console.log("Function call cancelled by user after loading");
              return undefined;
            }

            // Show prompting for input progress
            progress.report({
              message: `Collecting input for function '${functionName}'...`,
            });

            // Use the shared helper to collect arguments and run the function
            // Pass the cancellation token to allow cancellation during argument collection
            const { success, argValues } = await collectAndRunFunction(
              context,
              functionInfo
            );

            // If cancelled or not successful, don't show save task prompt
            if (token.isCancellationRequested || !success) {
              return undefined;
            }

            // if successful and the prompt is not dismissed
            if (settings.saveTaskPromptDismissed !== true) {
              await showSaveTaskPrompt(
                functionName!,
                argValues,
                workspacePath,
                settings,
                moduleName
              );
            }
            return undefined;
          } catch (error) {
            // Don't show error if the operation was cancelled
            if (token.isCancellationRequested) {
              console.log("Function call cancelled by user during execution");
              return undefined;
            }

            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to get function details: ${errorMessage}`
            );
            console.error("Error in call command:", error);
            return undefined;
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
};

/**
 * Loads functions and shows quick pick for selection
 * @param cli The Dagger CLI instance
 * @param workspacePath The workspace path
 * @returns The selected function details or undefined if cancelled
 */
const selectFunction = async (
  cli: Cli,
  workspacePath: string
): Promise<FunctionInfo | undefined> => {
  const functions = await cli.functionsList(workspacePath);

  if (functions.length === 0) {
    vscode.window.showInformationMessage(
      "No Dagger functions found in this project."
    );
    return undefined;
  }

  // Create QuickPickItems for display with index references to original functions
  const functionItems = functions.map((fn, index) => ({
    label: fn.name,
    description: `(${fn.module}) ${fn.description ? " " + fn.description : ""}`,
    detail: String(index), // Store the index to retrieve the original FunctionInfo
  }));

  const pick = await vscode.window.showQuickPick(functionItems, {
    placeHolder: "Select a function to call",
  });

  if (!pick) {
    return undefined;
  }

  // Return the original FunctionInfo object using the stored index
  const index = pick.detail ? parseInt(pick.detail, 10) : -1;
  return index >= 0 ? functions[index] : undefined;
};
