import * as vscode from "vscode";
import * as path from "path";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";
import { Command } from "./types";

export class ShellCommand implements Command {
  constructor(
    private context: vscode.ExtensionContext,
    private path: string,
  ) {}

  execute = async (): Promise<void> => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Dagger",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: `Opening Dagger shell...` });

        const existingTerminal = vscode.window.terminals.find(
          (t) => t.name === "Dagger",
        );
        if (existingTerminal) {
          existingTerminal.show();
          existingTerminal.sendText("dagger");
          return;
        }

        const newTerminal = vscode.window.createTerminal({
          name: "Dagger",
          iconPath: {
            light: vscode.Uri.file(
              path.join(this.context.extensionPath, ICON_PATH_BLACK),
            ),
            dark: vscode.Uri.file(
              path.join(this.context.extensionPath, ICON_PATH_WHITE),
            ),
          },
          cwd: this.path,
        });
        newTerminal.show();
        newTerminal.sendText("dagger");
      },
    );
  };
}
