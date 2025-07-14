import * as vscode from "vscode";
import Cli from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";
import { executeInTerminal } from "../../utils/terminal";

const COMMAND = "dagger.develop";

export const registerDevelopCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  _workspacePath: string
): void => {
  const disposable = vscode.commands.registerCommand(COMMAND, async () => {
    if (!(await cli.isDaggerProject())) {
      await showProjectSetupPrompt();
      return;
    }

    executeInTerminal(context, "dagger develop");
  });

  context.subscriptions.push(disposable);
};
