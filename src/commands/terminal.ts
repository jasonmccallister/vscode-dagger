import * as vscode from "vscode";
import * as path from "path";
import { DaggerCLI } from "../cli";
import { DaggerSettings } from "../settings";
import { Command } from "./types";
import {
  CollectedFunctionInput,
  collectFunctionInput,
  createPropertyFilter,
  executeTaskAndWait,
  showSelectFunctionQuickPick,
} from "../utils";
import { ContainerType } from "../types/types";

export class TerminalCommand implements Command {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
    private _settings: DaggerSettings,
  ) {}

  execute = async (): Promise<void> => {
    // get the functions from the Dagger CLI
    const functions = await this.dagger.getFunctions(this.path);
    if (!functions || functions.length === 0) {
      vscode.window.showErrorMessage(
        "No functions found in the current workspace. Please set up Dagger by running `Dagger: Init`.",
      );
      return;
    }

    // prompt the user to select a function
    // that returns a ServiceType or ContainerType
    const functionInfo = await showSelectFunctionQuickPick(
      functions,
      createPropertyFilter("returnType", [ContainerType]),
    );
    if (!functionInfo) {
      console.debug("No function selected for terminal command");

      return;
    }

    let functionInput: CollectedFunctionInput | undefined;
    const token = new vscode.CancellationTokenSource().token;

    functionInput = await collectFunctionInput(token, functionInfo);
    if (!functionInput) {
      console.log("Function call cancelled by user during input collection");
      return;
    }

    // append terminal to the command args
    const commandArgs = functionInput.commandArgs;
    if (!commandArgs) {
      vscode.window.showErrorMessage(
        `No command arguments provided for function \`${functionInfo.name}\`. Please provide at least one command argument.`,
      );
      return;
    }

    // append the terminal command
    commandArgs.push("terminal");
    if (commandArgs.length === 0) {
      vscode.window.showErrorMessage(
        `No command arguments provided for function \`${functionInfo.name}\`. Please provide at least one command argument.`,
      );
      return;
    }

    executeTaskAndWait(token, commandArgs.join(" "), {
      workingDirectory: this.path,
      runInBackground: false,
      // get the function input
    });
  };
}
