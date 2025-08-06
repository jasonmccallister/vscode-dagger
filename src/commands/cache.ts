import * as vscode from "vscode";
import { DaggerCLI } from "../cli";
import { Command } from "./types";

interface ClearCacheMessageItem extends vscode.MessageItem {
  title: string;
}

const YES_OPTION: ClearCacheMessageItem = { title: "Yes" };
const NO_OPTION: ClearCacheMessageItem = { title: "No" };

export class CacheCommand implements Command {
  constructor(private dagger: DaggerCLI) {}

  execute = async (): Promise<void> => {
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

    this.dagger.clearCache();

    vscode.window.showInformationMessage("Dagger cache cleared successfully.");
  };
}
