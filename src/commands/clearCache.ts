import * as vscode from "vscode";
import { DaggerCLI } from "../cli";

interface ClearCacheMessageItem extends vscode.MessageItem {
  title: string;
}

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
  daggerCli: DaggerCLI,
): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("dagger.clearCache", async () => {
      const response = await vscode.window.showWarningMessage(
        "Are you sure you want to clear the Dagger cache? This will remove all cached function data.",
        { modal: true },
        YES_OPTION,
        NO_OPTION,
      );

      if (!response || response.title === NO_OPTION.title) {
        // User cancelled the prompt
        return;
      }

      daggerCli.clearCache();
      vscode.window.showInformationMessage(
        "Dagger cache cleared successfully.",
      );
    }),
  );
};
