import * as vscode from "vscode";
import Cli from "../../dagger";
import { DaggerSettings } from "../../settings";

type CloudResponse = "Visit dagger.cloud" | "Open Settings" | "Cancel";

const COMMAND = "dagger.setupCloud";

interface TokenSources {
  readonly envToken: string | undefined;
  readonly secretToken: string;
  readonly currentToken: string;
}

export const registerCloudCommand = (
  context: vscode.ExtensionContext,
  _cli: Cli,
  settings: DaggerSettings,
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    const tokens = await getTokenSources();
    const message = getCloudMessage(tokens);
    const options = getResponseOptions(tokens);

    const response = (await vscode.window.showInformationMessage(
      message,
      ...options,
    )) as CloudResponse | undefined;

    await handleCloudResponse(response, tokens);

    // If user interacts with cloud setup, mark notification as dismissed
    if (response && response !== "Cancel") {
      await settings.update(
        "cloudNotificationDismissed",
        true,
        vscode.ConfigurationTarget.Global,
      );
    }
  });

  context.subscriptions.push(disposable);
};

/**
 * Gets token from various sources
 * @returns Object containing tokens from different sources
 */
const getTokenSources = async (): Promise<TokenSources> => {
  // We access current token from configuration directly
  // because cloudToken is not part of our settings interface
  const config = vscode.workspace.getConfiguration("dagger");
  const currentToken = config.get<string>("cloudToken", "");
  const envToken = process.env.DAGGER_CLOUD_TOKEN;

  let secretToken = "";
  try {
    const session = await vscode.authentication.getSession(
      "dagger",
      ["cloudToken"],
      { createIfNone: false },
    );
    secretToken = session?.accessToken ?? "";
  } catch {
    secretToken = "";
  }

  return {
    envToken,
    secretToken,
    currentToken,
  };
};

/**
 * Gets the response options based on the token sources
 * @param tokens The token sources
 * @returns Array of response options
 */
const getResponseOptions = (_tokens: TokenSources): CloudResponse[] => {
  const options: CloudResponse[] = ["Cancel"];

  // Add options in reverse order so they appear in the desired order
  options.unshift("Visit dagger.cloud");
  options.unshift("Open Settings");

  return options;
};

/**
 * Gets the cloud message based on token sources
 * @param tokens The token sources
 * @returns Message to display to the user
 */
const getCloudMessage = (tokens: TokenSources): string => {
  const { envToken, secretToken, currentToken } = tokens;

  if (envToken) {
    return "Dagger Cloud token found in environment variable DAGGER_CLOUD_TOKEN";
  }

  if (secretToken) {
    return "Dagger Cloud token found in VS Code secrets storage";
  }

  if (currentToken) {
    return "Dagger Cloud token found in VS Code settings";
  }

  return "Connect to Dagger Cloud for enhanced features";
};

/**
 * Handles the cloud response
 * @param response The user's response
 * @param tokens The token sources
 */
const handleCloudResponse = async (
  response: CloudResponse | undefined,
  _tokens: TokenSources,
): Promise<void> => {
  if (!response || response === "Cancel") {
    return;
  }

  if (response === "Visit dagger.cloud") {
    await vscode.env.openExternal(vscode.Uri.parse("https://dagger.cloud"));
    return;
  }

  if (response === "Open Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "dagger.cloudToken",
    );
    return;
  }
};
