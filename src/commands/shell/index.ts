import * as vscode from "vscode";
import * as path from "path";
import { EXTENSION_NAME, ICON_PATH_BLACK, ICON_PATH_WHITE } from "../../const";

const COMMAND = "dagger.shell";
const shellCommand = "dagger shell";

export const registerShellCommand = (
  context: vscode.ExtensionContext,
  workspacePath: string
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: EXTENSION_NAME,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: `Opening ${EXTENSION_NAME} shell...` });

        const existingTerminal = vscode.window.terminals.find(
          (t) => t.name === EXTENSION_NAME
        );
        if (existingTerminal) {
          existingTerminal.show();
          existingTerminal.sendText(shellCommand);
          return;
        }

        const newTerminal = vscode.window.createTerminal({
          name: EXTENSION_NAME,
          iconPath: {
            light: vscode.Uri.file(
              path.join(context.extensionPath, ICON_PATH_BLACK)
            ),
            dark: vscode.Uri.file(
              path.join(context.extensionPath, ICON_PATH_WHITE)
            ),
          },
          cwd: workspacePath,
        });
        newTerminal.show();
        newTerminal.sendText(shellCommand);
      }
    );
  });

  context.subscriptions.push(disposable);

  // Show Dagger Shell terminal when opened (including from profile quick pick)
  const showDaggerShellTerminal = vscode.window.onDidOpenTerminal(
    (terminal) => {
      if (terminal.name === EXTENSION_NAME) {
        terminal.show();
      }
    }
  );
  context.subscriptions.push(showDaggerShellTerminal);
};
