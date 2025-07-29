import * as vscode from "vscode";
import Cli, { FunctionInfo } from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";
import {
  collectFunctionInput,
  runFunction,
  selectFunction,
  showSaveTaskPrompt,
} from "../../utils/function-helpers";
import { DaggerTreeItem } from "../../tree/provider";
import { DaggerSettings } from "../../settings";

export const registerCallCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspacePath: string,
  settings: DaggerSettings,
): void => {
  const disposable = vscode.commands.registerCommand(
    "dagger.call",
    async (input?: DaggerTreeItem) => {
      if (!(await cli.isDaggerProject())) {
        return showProjectSetupPrompt();
      }

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
          "No function selected. Please select a function to call.",
        );
        return;
      }

      const token = new vscode.CancellationTokenSource().token;

      const options = await preRunOptions(token, functionInfo);
      if (!options) {
        console.log("Function call cancelled by user during pre-run options");
        return;
      }

      // skip progress if the user has selected options that are long running such as running in terminal or exposing as service
      if (options.SkipProgress) {
        // get the user input for the function
        let functionInput = await collectFunctionInput(token, functionInfo);
        if (!functionInput) {
          console.log(
            "Function call cancelled by user during input collection",
          );
          return undefined;
        }

        // add the command to run the function
        if (
          options.CommandArgsToAppend &&
          options.CommandArgsToAppend.length > 0
        ) {
          // append the command to run the function
          functionInput.commandArgs.push(...options.CommandArgsToAppend);
        }

        const result = await runFunction(token, workspacePath, functionInput);
        if (!result) {
          vscode.window.showErrorMessage(
            `Failed to run function \`${functionInfo.name}\`. Please check the output for details.`,
          );
          return undefined;
        }

        // if successful and the prompt is not dismissed
        if (settings.saveTaskPromptDismissed !== true) {
          await showSaveTaskPrompt(
            functionInfo.name!,
            functionInput.argValues,
            workspacePath,
            settings,
            functionInfo.module,
          );
        }

        return undefined;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Dagger",
          cancellable: true,
        },
        async (progress, token) => {
          try {
            let functionName: string = functionInfo?.name;
            let moduleName: string = functionInfo?.module;

            progress.report({
              message: `Running function \`${functionName}\`${functionInfo.parentModule ? ` in module ${functionInfo.module}` : ""}`,
            });

            if (token.isCancellationRequested) {
              console.log("Function call cancelled by user");
              return undefined;
            }

            // get the user input for the function
            let functionInput = await collectFunctionInput(token, functionInfo);
            if (!functionInput) {
              console.log(
                "Function call cancelled by user during input collection",
              );
              return undefined;
            }

            // add the command to run the function
            if (
              options.CommandArgsToAppend &&
              options.CommandArgsToAppend.length > 0
            ) {
              // append the command to run the function
              functionInput.commandArgs.push(...options.CommandArgsToAppend);
            }

            const result = await runFunction(
              token,
              workspacePath,
              functionInput,
            );
            if (!result) {
              vscode.window.showErrorMessage(
                `Failed to run function \`${functionName}\`. Please check the output for details.`,
              );
              return undefined;
            }

            // if successful and the prompt is not dismissed
            if (settings.saveTaskPromptDismissed !== true) {
              await showSaveTaskPrompt(
                functionName!,
                functionInput.argValues,
                workspacePath,
                settings,
                moduleName,
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
              `Failed to get function details: ${errorMessage}`,
            );
            console.error("Error in call command:", error);
            return undefined;
          }
        },
      );
    },
  );

  context.subscriptions.push(disposable);
};

export interface SelectedActions {
  OpenTerminal?: boolean;
  ExposeService?: boolean;
  Ports?: Record<number, number>;
  CommandArgsToAppend?: string[];
  SkipProgress?: boolean;
}

/**
 * This looks at the return type of the function and prompts the user for options such as:
 * - If the function returns a Container, ask if they want to run it in a terminal or expose it as a service
 * - If the function returns a Service, ask if they want to expose it
 * - If the function returns a File or Directory, ask if they want to export it to a local path
 *
 * @param token
 * @param workspacePath
 * @param functionInfo
 */
const preRunOptions = async (
  token: vscode.CancellationToken,
  functionInfo: FunctionInfo,
) => {
  const returnType = functionInfo.returnType;
  let message = `\`${functionInfo.name}\` returns a ${returnType}.`;
  let optionItems: string[] = [];

  switch (returnType) {
    case "Container":
      optionItems.push("Run in Terminal");
      optionItems.push("Expose Service");
      break;
    case "Service":
      optionItems.push("Expose Service");
      break;
    case "File":
    case "Directory":
      // Ask if they want to export it to a local path
      optionItems.push("Export to Host");
      break;
    default:
    // do nothing
  }

  // always add the option to ignore extra steps
  optionItems.push("Ignore and continue");

  const selectedActions: SelectedActions = {
    SkipProgress: true,
  };

  const selected = await vscode.window.showQuickPick(optionItems, {
    placeHolder: message,
  });

  if (!selected || token.isCancellationRequested) {
    return undefined;
  }

  switch (selected) {
    case "Run in Terminal":
      selectedActions.OpenTerminal = true;
      selectedActions.CommandArgsToAppend = ["terminal"];
      selectedActions.SkipProgress = true;
      break;
    case "Expose Service":
      selectedActions.ExposeService = true;
      // For Container functions, need "as-service up", for Service functions just "up"
      if (functionInfo.returnType === "Container") {
        selectedActions.CommandArgsToAppend = ["as-service", "up"];
      } else {
        selectedActions.CommandArgsToAppend = ["up"];
      }
      selectedActions.SkipProgress = true;
      break;
    case "Export to Host":
      // Handle export logic here if needed
      break;
    case "Ignore and continue":
      selectedActions.SkipProgress = false;
      break;
  }

  // do we need to ask for ports?
  if (selectedActions.ExposeService) {
    const ports = await vscode.window.showInputBox({
      prompt: `Enter ports to expose for function \`${functionInfo.name}\` (comma-separated, e.g. 8080:8080)`,
      placeHolder: "e.g. 8080:8080",
      value: "8080:8080",
      validateInput: (value) => {
        // Simple validation for port format
        const regex = /^\d+(:\d+)?(,\d+(:\d+)?)*$/;
        return regex.test(value)
          ? null
          : "Invalid port format. Use '8080:8080' or '8080,9090:9090'";
      },
    });

    if (ports) {
      selectedActions.Ports = ports.split(",").reduce(
        (acc, port) => {
          const [host, container] = port.split(":");
          acc[Number(host)] = Number(container);
          return acc;
        },
        {} as Record<number, number>,
      );

      // Add port mappings to command args
      if (selectedActions.Ports) {
        const portMappings = Object.entries(selectedActions.Ports).map(
          ([host, container]) => `${host}:${container}`,
        );

        // Add each port mapping individually with its own --ports flag
        portMappings.forEach((mapping) => {
          selectedActions.CommandArgsToAppend?.push("--ports", mapping);
        });
      }
    }
  }

  return selectedActions;
};
