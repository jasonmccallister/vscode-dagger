import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { executeTaskAndWait } from "../utils";

export const registerStartGraphQLServer = (
  context: vscode.ExtensionContext,
  _daggerCli: DaggerCLI,
  workspace: string,
) => {
  const disposable = vscode.commands.registerCommand(
    "dagger.startGraphQLServer",
    async () => {
      let command = ["dagger", "listen"];

      await allowCorsPrompt(command);

      await allowLLMPrompt(command);

      await listenAddressPrompt(command, "127.0.0.1:8080");

      const auth = await basicAuthPrompt();

      vscode.window.showInformationMessage(
        "Starting GraphQL server:\n" + `Basic Auth: ${auth.token}`,
      );

      const token = new vscode.CancellationTokenSource().token;

      // put env DAGGER_SESSION_TOKEN=auth.value in the beginning of the command array
      command = ["env", "DAGGER_SESSION_TOKEN=" + auth.value, ...command];

      executeTaskAndWait(token, command.join(" "), {
        runInBackground: false,
        workingDirectory: workspace,
      });
    },
  );

  context.subscriptions.push(disposable);
};

const listenAddressPrompt = async (
  commandArgs: string[],
  defaultAddress: string,
) => {
  if (process.env.DAGGER_LISTEN_ADDRESS) {
    commandArgs.push("--listen", process.env.DAGGER_LISTEN_ADDRESS);
    return;
  }

  const address = await vscode.window.showInputBox({
    placeHolder: "Enter the listen address",
    prompt: "Listen address for the GraphQL server",
    value: defaultAddress,
    validateInput: (value) => {
      const parts = value.split(":");
      if (parts.length !== 2) {
        return "Invalid address format. Use 'host:port'.";
      }
      const port = parseInt(parts[1], 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        return "Port must be a number between 1 and 65535.";
      }
      return null; // No error
    },
  });

  if (!address) {
    console.debug("No address specified, using default");
    return;
  }

  commandArgs.push("--listen", address);
};

const allowCorsPrompt = async (commandArgs: string[]) => {
  if (process.env.DAGGER_ALLOW_CORS === "true") {
    commandArgs.push("--allow-cors");
    return;
  }

  const allowCors = await vscode.window.showQuickPick(["Yes", "No"], {
    placeHolder: "Allow CORS?",
    canPickMany: false,
  });

  if (allowCors === "Yes") {
    commandArgs.push("--allow-cors");
  }
};

const allowLLMPrompt = async (commandArgs: string[]) => {
  if (process.env.DAGGER_ALLOW_LLM === "true") {
    commandArgs.push("--allow-llm=all");
    return;
  }

  const allowLLM = await vscode.window.showQuickPick(["Yes", "No"], {
    placeHolder: "Allow LLM connections for specific modules?",
    canPickMany: false,
  });

  if (allowLLM === "Yes") {
    // ask for the modules to allow, can be multiple
    const modules = await vscode.window.showInputBox({
      placeHolder:
        "Enter modules to allow (comma separated). Example: module1,module2. Enter 'all' to allow all modules.",
      prompt: "Modules to allow for LLM connections",
      validateInput: (value) => {
        if (!value) {
          return "No modules specified.";
        }
        if (value.toLowerCase() === "all") {
          return null; // No error for 'all'
        }
        const modules = value.split(",").map((m) => m.trim());
        if (modules.length === 0) {
          return "At least one module must be specified.";
        }

        return null; // No error
      },
    });

    if (!modules) {
      vscode.window.showWarningMessage(
        "No modules specified for LLM connections.",
      );
    } else {
      if (modules.toLowerCase() === "all") {
        commandArgs.push("--allow-llm=all");
      } else {
        const moduleList = modules.split(",").map((m) => m.trim());
        commandArgs.push("--allow-llm=", ...moduleList);
      }
    }
  }
};

interface AuthPromptResult {
  token: string;
  value: string;
}

const basicAuthPrompt = async (): Promise<AuthPromptResult> => {
  if (process.env.DAGGER_SESSION_TOKEN) {
    return {
      token: Buffer.from(process.env.DAGGER_SESSION_TOKEN).toString("base64"),
      value: process.env.DAGGER_SESSION_TOKEN,
    };
  }

  const auth = await vscode.window.showInputBox({
    placeHolder: "Set Basic Auth Token (optional)",
    value: "test",
    prompt: "Enable Basic Auth for the GraphQL server",
    validateInput: (value) => {
      if (!value) {
        return "No Basic Auth token specified.";
      }
      return null; // No error
    },
  });

  // get the auth token and create the value
  if (!auth) {
    return { token: "", value: "" };
  }

  return {
    token: Buffer.from(`${auth}`).toString("base64"),
    value: auth,
  };
};
