import * as vscode from "vscode";
import Cli from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";
import {
  collectFunctionInput,
  createPropertyFilter,
  runFunction,
  selectFunction,
} from "../../utils/function-helpers";
import { DaggerSettings } from "../../settings";
import { ContainerType, ServiceType } from "../../dagger/types";

export const registerExposeServiceCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspacePath: string,
  _settings: DaggerSettings,
): void => {
  const disposable = vscode.commands.registerCommand(
    "dagger.exposeService",
    async () => {
      if (!(await cli.isDaggerProject())) {
        return showProjectSetupPrompt();
      }

      // Ensure CLI has the workspace path set
      cli.setWorkspacePath(workspacePath);

      // selectFunction now returns the full FunctionInfo object
      let functionInfo = await selectFunction(
        cli,
        workspacePath,
        createPropertyFilter("returnType", [ServiceType, ContainerType]),
      );

      if (!functionInfo) {
        return; // Selection cancelled
      }

      const token = new vscode.CancellationTokenSource().token;

      let functionInput = await collectFunctionInput(token, functionInfo);
      if (!functionInput) {
        console.log("Function call cancelled by user during input collection");
        return;
      }

      let ports: Record<number, number> | undefined;
      const portsInput = await vscode.window.showInputBox({
        prompt: `Enter ports to expose for function \`${functionInfo.name}\` (comma-separated, e.g. 8080:8080)`,
        placeHolder: "e.g. 8080:8080",
        value: "8080:8080",
        validateInput: (value) => {
          // Simple validation for port format - this should be improved
          const regex = /^\d+(:\d+)?(,\d+(:\d+)?)*$/;
          return regex.test(value)
            ? null
            : "Invalid port format. Use '8080:8080' or '8080,9090:9090'";
        },
      });

      if (portsInput) {
        ports = portsInput.split(",").reduce(
          (acc, port) => {
            const [host, container] = port.split(":");
            acc[Number(host)] = Number(container);
            return acc;
          },
          {} as Record<number, number>,
        );

        // Prepare port mappings in the correct format (frontend:backend)
        const portMappings = Object.entries(ports).map(
          ([host, container]) => `${host}:${container}`,
        );

        // append the command args to the function input
        if (functionInfo.returnType === ContainerType) {
          functionInput.commandArgs.push("as-service", "up");

          // Add each port mapping individually with its own --ports flag
          portMappings.forEach((mapping) => {
            functionInput.commandArgs.push("--ports", mapping);
          });
        }

        if (functionInfo.returnType === ServiceType) {
          functionInput.commandArgs.push("up");

          // Add each port mapping individually with its own --ports flag
          portMappings.forEach((mapping) => {
            functionInput.commandArgs.push("--ports", mapping);
          });
        }
      }

      const result = await runFunction(token, workspacePath, functionInput);
      if (!result) {
        vscode.window.showErrorMessage(
          `Failed to run function \`${functionInfo.name}\`. Please check the output for details.`,
        );

        return undefined;
      }

      return undefined;
    },
  );

  context.subscriptions.push(disposable);
};
