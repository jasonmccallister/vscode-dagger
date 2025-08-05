import * as vscode from "vscode";
import {
  collectFunctionInput,
  createPropertyFilter,
  runFunction,
  showSelectFunctionQuickPick,
} from "../utils/function-helpers";
import { DaggerSettings } from "../settings";
import { DaggerCLI } from "../cli";
import { ContainerType, ServiceType } from "../types/types";
import { Command } from "./types";
import { askForPorts } from "../utils/user-input";

export class ExposeServiceCommand implements Command {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
    private _settings: DaggerSettings,
  ) {}

  execute = async (): Promise<void> => {
    const token = new vscode.CancellationTokenSource().token;

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
      createPropertyFilter("returnType", [ServiceType, ContainerType]),
    );
    if (!functionInfo) {
      console.debug("No function selected for exposeService command");
      return;
    }

    // get the function input
    let functionInput = await collectFunctionInput(token, functionInfo);
    if (!functionInput) {
      console.log("Function call cancelled by user during input collection");
      return;
    }

    // prompt for ports
    const ports = await askForPorts(functionInfo.name);
    if (!ports || ports.length === 0) {
      vscode.window.showInformationMessage(
        `No ports specified for function \`${functionInfo.name}\`.`,
      );
    }

    // append the command args to the function input
    switch (functionInfo.returnType) {
      case ContainerType:
        // if the function returns a ContainerType, we need to run it with `as-service up`
        functionInput.commandArgs.push("as-service", "up");
        break;
      case ServiceType:
        // if the function returns a ContainerType, we need to run it with `as-service up`
        functionInput.commandArgs.push("up");
        break;
      default:
        vscode.window.showErrorMessage(
          `Function \`${functionInfo.name}\` does not return a ServiceType or ContainerType.`,
        );
        return;
    }

    // Add each port mapping individually with its own --ports flag
    if (ports && ports.length > 0) {
      ports.forEach((mapping) => {
        functionInput.commandArgs.push("--ports", mapping);
      });
    }

    // run the function with the provided inputs
    const result = await runFunction(token, this.path, functionInput);
    if (!result) {
      console.error(
        `Failed to run function \`${functionInfo.name}\`. Please check the output for details.`,
      );

      vscode.window.showErrorMessage(
        `Failed to run function \`${functionInfo.name}\`. Please check the output for details.`,
      );

      return;
    }

    return;
  };
}
