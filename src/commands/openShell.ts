import * as vscode from "vscode";
import * as path from "path";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";

export const registerShellCommand = (
  context: vscode.ExtensionContext,
  workspace: string,
): void => {
  const disposable = vscode.commands.registerCommand("dagger.shell", async () => {
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
              path.join(context.extensionPath, ICON_PATH_BLACK),
            ),
            dark: vscode.Uri.file(
              path.join(context.extensionPath, ICON_PATH_WHITE),
            ),
          },
          cwd: workspace,
        });
        newTerminal.show();
        newTerminal.sendText("dagger");
      },
    );
  });

  context.subscriptions.push(disposable);

  // Show Dagger Shell terminal when opened (including from profile quick pick)
  const showDaggerShellTerminal = vscode.window.onDidOpenTerminal(
    (terminal) => {
      if (terminal.name === "Dagger") {
        terminal.show();
      }
    },
  );
  
  context.subscriptions.push(showDaggerShellTerminal);
};
