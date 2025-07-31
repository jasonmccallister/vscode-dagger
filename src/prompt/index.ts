import * as vscode from "vscode";
import { DaggerSettings } from "../settings";

type CloudPromptResponse = "Sign up" | "Learn More" | "Don't show again";

type InitChoice = "Run Init" | "No";

interface CloudTokenSources {
  readonly secretToken: string | undefined;
  readonly envToken: string | undefined;
}

export const showProjectSetupPrompt = async (): Promise<void> => {
  // Ask the user if they want to run the init command
  const choice = (await vscode.window.showErrorMessage(
    `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
    { modal: true },
    "Run Init",
    "No",
  )) as InitChoice | undefined;

  if (choice === "Run Init") {
    await vscode.commands.executeCommand("dagger.init");
  }
};

/**
 * Checks if cloud tokens are available from various sources
 * @param context The extension context
 * @returns Object containing available tokens
 */
const getCloudTokenSources = async (
  context: vscode.ExtensionContext,
): Promise<CloudTokenSources> => {
  const secretToken = await context.secrets.get("dagger.cloudToken");
  const envToken = process.env.DAGGER_CLOUD_TOKEN;

  return { secretToken, envToken };
};

/**
 * Handles the cloud prompt response
 * @param response The user's response
 * @param settings The Dagger settings
 */
const handleCloudPromptResponse = async (
  response: CloudPromptResponse | undefined,
  settings: DaggerSettings,
): Promise<void> => {
  switch (response) {
    case "Sign up":
      await vscode.env.openExternal(vscode.Uri.parse("https://dagger.cloud"));
      break;

    case "Learn More":
      await vscode.env.openExternal(
        vscode.Uri.parse("https://dagger.io/cloud"),
      );
      break;

    case "Don't show again":
      await settings.update(
        "cloudNotificationDismissed",
        true,
        vscode.ConfigurationTarget.Global,
      );
      break;
  }
};
