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
    async (input?: DaggerTreeItem | string) => {
      if (!(await cli.isDaggerProject())) {
        return showProjectSetupPrompt();
      }

      // Ensure CLI has the workspace path set
      cli.setWorkspacePath(workspacePath);

      let functionName: string | undefined;
      let functionId: string | undefined;
      let moduleName: string | undefined;
      let hasArgumentChildren = false;
      let functionInfo: FunctionInfo | undefined;

      // No input, prompt user to select a function
      if (input === undefined) {
        // selectFunction now returns the full FunctionInfo object
        functionInfo = await selectFunction(cli, workspacePath);

        if (!functionInfo) {
          return; // Selection cancelled
        }

        // Extract the basic properties from the functionInfo object
        functionName = functionInfo.name;
        functionId = functionInfo.functionId;
        moduleName = functionInfo.module;
        console.log(
          `Quick pick function selected: ID=${functionId}, name=${functionName}, module=${moduleName}`
        );
      }

      // Determine function selection method
      if (input instanceof DaggerTreeItem && input.functionInfo?.functionId) {
        // Function selected from tree view - use the full functionInfo object
        functionInfo = input.functionInfo;
        functionId = functionInfo.functionId;
        functionName = input.originalName;
        moduleName = functionInfo.module;
        // Check if this tree item already has argument children
        hasArgumentChildren = Boolean(
          input.children && input.children.length > 0
        );
        console.log(
          `Tree view function selected: ID=${functionId}, name=${functionName}, module=${moduleName}`
        );
      }

      if (typeof input === "string") {
        // Function ID passed as string
        functionId = input;
        console.log(`Function ID passed as string: ${functionId}`);
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Dagger",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Getting function arguments..." });

          try {
            // Get function details from the Dagger CLI if needed
            if (functionId) {
              // If functionInfo is already set (from tree item or quick pick), use it directly
              if (!functionInfo) {
                // If we don't have functionInfo yet, we need to fetch it
                progress.report({
                  message: `Loading function (ID: ${functionId})...`,
                });
                console.log(
                  `Retrieving function details for ID: ${functionId}`
                );

                // Get function details
                functionInfo = await cli.getFunction(functionId, workspacePath);
                console.log(
                  `Function details retrieved: ${
                    functionInfo ? "success" : "failed"
                  }`
                );

                if (!functionInfo) {
                  vscode.window.showErrorMessage(
                    `Failed to get details for function with ID ${functionId}`
                  );
                  return;
                }
              }

              // Set properties from function info
              functionName = functionInfo.name;
              moduleName = functionInfo.module;
              console.log(
                `Using function name: ${functionName}, module: ${moduleName}`
              );
            } else {
              vscode.window.showErrorMessage("No function selected");
              return;
            }

            // Show prompting for input progress
            progress.report({
              message: `Collecting input for function '${functionName}'...`,
            });

            // Use the shared helper to collect arguments and run the function
            const { success, argValues } = await collectAndRunFunction(
              context,
              functionInfo
            );

            // if successful and the prompt is not dismissed
            if (success && settings.saveTaskPromptDismissed !== true) {
              await showSaveTaskPrompt(
                functionName!,
                argValues,
                workspacePath,
                settings,
                moduleName
              );
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to get function details: ${errorMessage}`
            );
            console.error("Error in call command:", error);
            return;
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
