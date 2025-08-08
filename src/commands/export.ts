import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { DaggerSettings } from "../settings";
import { Command } from "./types";
import {
  collectFunctionInput,
  createPropertyFilter,
  runFunction,
  showSaveTaskPrompt,
  showSelectFunctionQuickPick,
} from "../utils";
import { DirectoryType, FileType } from "../types/types";
import path from "path";
import { askForExportPath, askForFileName } from "../utils/user-input";

export class ExportCommand implements Command {
  constructor(
    private dagger: DaggerCLI,
    private path: string,
    private settings: DaggerSettings,
  ) {}

  execute = async (): Promise<void> => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Export",
        cancellable: true,
      },
      async (progress, token) => {
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
          createPropertyFilter("returnType", [DirectoryType, FileType]),
        );
        if (!functionInfo) {
          console.debug("No function selected for export command");

          vscode.window.showInformationMessage(
            "Export operation cancelled. No function selected.",
          );
          return;
        }

        progress.report({
          message: `Preparing to export \'${functionInfo.returnType} from \`${functionInfo.name}\`...`,
        });

        // get the function input
        let functionInput = await collectFunctionInput(token, functionInfo);
        if (!functionInput) {
          console.log(
            "Function call cancelled by user during input collection",
          );
          return;
        }

        // prompt for the export path, default to ./dist
        let exportPath = await askForExportPath();
        if (!exportPath) {
          vscode.window.showInformationMessage(
            "Export path not specified. Operation cancelled.",
          );
          return;
        }

        progress.report({
          message: `Path set to \`${exportPath}\`.`,
        });

        // if the return type is a file, ask for the file name
        if (functionInfo.returnType === FileType) {
          const fileName = await askForFileName();
          if (!fileName) {
            vscode.window.showInformationMessage(
              "File name not specified. Operation cancelled.",
            );
            return;
          }

          exportPath = path.join(exportPath, fileName);

          progress.report({
            message: `Filename set to \`${fileName}\`. Export path: \`${exportPath}\`.`,
          });
        }

        functionInput.commandArgs.push("export", "--path", exportPath);

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

        vscode.window.showInformationMessage(
          `Function \`${functionInfo.name}\` exported successfully to \`${exportPath}\`.`,
        );

        // if successful and the prompt is not dismissed
        if (this.settings.saveTaskPromptDismissed !== true) {
          await showSaveTaskPrompt(
            functionInfo.name,
            functionInput.argValues,
            this.path,
            this.settings,
            functionInfo.module,
          );
        }
      },
    );
  };
}
