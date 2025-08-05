import * as vscode from "vscode";
import { FunctionInfo } from "../types/types";
import {
  CollectedFunctionInput,
  collectFunctionInput,
  runFunction,
  showSaveTaskPrompt,
  showSelectFunctionQuickPick,
} from "../utils/function-helpers";
import { DaggerTreeItem } from "../tree/provider";
import { DaggerSettings } from "../settings";
import { DaggerCLI } from "../cli";
import { askForPorts } from "../utils/user-input";
import { Command } from "./types";

export class CallFunctionCommand implements Command<DaggerTreeItem> {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
    private settings: DaggerSettings,
  ) {}

  preExecute(): Promise<boolean> {
    // TODO(jasonmccallister): verify this is a Dagger project
    return Promise.resolve(true);
  }

  async execute(input?: DaggerTreeItem): Promise<void> {
    let functionInfo: FunctionInfo | undefined;
    let functionInput: CollectedFunctionInput | undefined;
    const token = new vscode.CancellationTokenSource().token;

    // Check the type of input to determine how to proceed
    if (input === undefined) {
      // No input provided, we will prompt the user to select a function
      const functions = await this.dagger.getFunctions(this.path);
      if (!functions || functions.length === 0) {
        // If no functions are found, prompt the user to set up the project
        vscode.window.showInformationMessage(
          "No functions found. Please set up your Dagger project.",
        );
        return;
      }

      functionInfo = await showSelectFunctionQuickPick(functions);
      if (!functionInfo) {
        vscode.window.showInformationMessage(
          "No function selected. Please select a function to call.",
        );
        return;
      }
    } else if (
      input instanceof DaggerTreeItem &&
      input.functionInfo !== undefined
    ) {
      // Input is a tree item with function info
      functionInfo = input.functionInfo;
    }

    // we should have a functionInfo at this point
    if (!functionInfo) {
      vscode.window.showErrorMessage(
        "No function selected. Please select a function to call.",
      );
      return;
    }

    const options = await preRunOptions(token, functionInfo);
    if (!options) {
      console.log("Function call cancelled by user during pre-run options");
      return;
    }

    // skip progress if the user has selected options that are long running such as running in terminal or exposing as service
    if (options.SkipProgress) {
      // get the user input for the function
      functionInput = await collectFunctionInput(token, functionInfo);
      if (!functionInput) {
        console.log(
          "Function call cancelled by user during input collection",
        );
        return;
      }

      // add the command to run the function
      if (
        options.CommandArgsToAppend &&
        options.CommandArgsToAppend.length > 0
      ) {
        // append the command to run the function
        functionInput.commandArgs.push(...options.CommandArgsToAppend);
      }

      const result = await runFunction(token, this.path, functionInput);
      if (!result) {
        vscode.window.showErrorMessage(
          `Failed to run function \`${functionInfo.name}\`. Please check the output for details.`,
        );
        return;
      }

      // if successful and the prompt is not dismissed
      if (this.settings.saveTaskPromptDismissed !== true) {
        await showSaveTaskPrompt(
          functionInfo.name!,
          functionInput.argValues,
          this.path,
          this.settings,
          functionInfo.module,
        );
      }

      return;
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
          let moduleName: string | undefined = functionInfo?.module;

          progress.report({
            message: `Running function \`${functionName}\`${moduleName ? ` in module ${moduleName}` : ""}`,
          });

          if (token.isCancellationRequested) {
            console.log("Function call cancelled by user");
            return;
          }

          // get the user input for the function
          let functionInput = await collectFunctionInput(token, functionInfo);
          if (!functionInput) {
            console.log(
              "Function call cancelled by user during input collection",
            );
            return;
          }

          // add the command to run the function
          if (
            options.CommandArgsToAppend &&
            options.CommandArgsToAppend.length > 0
          ) {
            // append the command to run the function
            functionInput.commandArgs.push(...options.CommandArgsToAppend);
          }

          const result = await runFunction(token, this.path, functionInput);
          if (!result) {
            vscode.window.showErrorMessage(
              `Failed to run function \`${functionName}\`. Please check the output for details.`,
            );
            return;
          }

          // if successful and the prompt is not dismissed
          if (this.settings.saveTaskPromptDismissed !== true) {
            await showSaveTaskPrompt(
              functionName!,
              functionInput.argValues,
              this.path,
              this.settings,
              moduleName,
            );
          }

          return;
        } catch (error) {
          // Don't show error if the operation was cancelled
          if (token.isCancellationRequested) {
            console.log("Function call cancelled by user during execution");
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to get function details: ${errorMessage}`,
          );
          console.error("Error in call command:", error);
          return;
        }
      },
    );
  }

  postExecute?(): Promise<void> {
    // This command does not require post-execution actions
    return Promise.resolve();
  }
}

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
): Promise<SelectedActions | undefined> => {
  const returnType = functionInfo.returnType;
  let message = `\`${functionInfo.name}\` returns a ${returnType}.`;
  let optionItems: string[] = [];
  let selectedActions: SelectedActions = {
    SkipProgress: false,
  };

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
      // do nothing and return
      console.debug(
        `Function \`${functionInfo.name}\` has an unsupported return type: ${returnType}`,
      );

      return selectedActions;
  }

  // always add the option to ignore extra steps
  optionItems.push("Ignore and continue");

  selectedActions.SkipProgress = true;

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

      const ports = await askForPorts(functionInfo.name);

      if (ports && selectedActions.CommandArgsToAppend) {
        selectedActions.CommandArgsToAppend!.push(
          "--ports",
          `${ports.join(",")}`,
        );
      }

      break;
    case "Export to Host":
      // Handle export logic here if needed
      break;
    case "Ignore and continue":
      selectedActions.SkipProgress = false;
      break;
  }

  return selectedActions;
};
