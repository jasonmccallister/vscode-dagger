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

export const COMMAND = "dagger.call";

export const registerCallCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspacePath: string,
  settings: DaggerSettings,
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
          "No function selected. Please select a function to call.",
        );
        return;
      }

      let message = `\`${functionInfo.name}\` returns a ${functionInfo.returnType}.`;
      let commandToAppend = [];
      let showProgress = true;

      switch (functionInfo.returnType) {
        case "Container":
          const containerAction = await vscode.window.showInformationMessage(
            `${message} Do you want to run it in a terminal or expose it as a service?`,
            "Open Terminal",
            "Expose Service",
          );

          if (!containerAction) {
            console.log("No action selected for container function");
            break;
          }

          switch (containerAction) {
            case "Open Terminal":
              console.log(
                `Running function \`${functionInfo.name}\` in terminal...`,
              );

              commandToAppend.push(`terminal`);

              showProgress = false; // No progress needed for terminal

              break;
            case "Expose Service":
              console.log(
                `Exposing function \`${functionInfo.name}\` as a service...`,
              );

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
                commandToAppend.push(`as-service up --ports ${ports}`);
                showProgress = false; // No progress needed for service
              }

              break;
          }
          break;
        case "Service":
          // ask the user if they want to run this in a terminal or expose as a service?
          const serviceAction = await vscode.window.showInformationMessage(
            `${message} Do you want to expose it?`,
            "Expose Service",
          );
          if (!serviceAction) {
            console.log("No action selected for service function");
            break;
          }

          switch (serviceAction) {
            case "Expose Service":
              vscode.window.showInformationMessage(
                `Exposing function \`${functionInfo.name}\` as a service...`,
              );

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
                commandToAppend.push(`up --ports ${ports}`);
                showProgress = false; // No progress needed for service
              }

              break;
          }
      }

      if (!showProgress) {
        let token = new vscode.CancellationTokenSource().token;

        // get the user input for the function
        let functionInput = await collectFunctionInput(token, functionInfo);
        if (!functionInput) {
          console.log(
            "Function call cancelled by user during input collection",
          );
          return undefined;
        }

        // add the command to run the function
        if (commandToAppend.length > 0) {
          // append the command to run the function
          functionInput.commandArgs.push(...commandToAppend);
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
            if (commandToAppend.length > 0) {
              // append the command to run the function
              functionInput.commandArgs.push(...commandToAppend);
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
