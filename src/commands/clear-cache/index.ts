import * as vscode from "vscode";
import Cli from "../../dagger";

interface ClearCacheMessageItem extends vscode.MessageItem {
  title: string;
}

const COMMAND = "dagger.clearCache";
const YES_OPTION: ClearCacheMessageItem = { title: "Yes" };
const NO_OPTION: ClearCacheMessageItem = { title: "No" };

/**
 * Registers the clear cache command
 *
 * @param context The extension context
 * @param cli The Dagger CLI instance with cache access
 */
export const registerClearCacheCommand = (
  context: vscode.ExtensionContext,
  cli: Cli
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    const response = await vscode.window.showWarningMessage(
      "Are you sure you want to clear the Dagger cache? This will remove all cached function data.",
      { modal: true },
      YES_OPTION,
      NO_OPTION
    );

    if (response && response.title === YES_OPTION.title) {
      await clearCache(cli);
    }
  });

  context.subscriptions.push(disposable);
};

/**
 * Clears the Dagger CLI cache
 * @param cli The Dagger CLI instance with cache access
 */
const clearCache = async (cli: Cli): Promise<void> => {
  try {
    await cli.clearCache();
    vscode.window.showInformationMessage(
      "Dagger cache has been cleared successfully."
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to clear Dagger cache: ${error}`);
  }
};
