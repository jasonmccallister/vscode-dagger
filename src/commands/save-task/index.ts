import * as vscode from "vscode";
import * as path from "path";
import Cli, { FunctionInfo } from "../../dagger";
import {
  buildCommandArgs,
  collectArgumentValues,
  selectOptionalArguments,
} from "../../utils/function-helpers";

export const COMMAND = "dagger.saveTask";

export const registerSaveTaskCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspacePath: string,
): void => {
  const disposable = vscode.commands.registerCommand(
    COMMAND,
    async (func?: string | vscode.TreeItem) => {
      let functionName: string | undefined;

      // Support both string and TreeItem
      if (typeof func === "string") {
        functionName = func;
      } else if (func && typeof func === "object" && "label" in func) {
        functionName = typeof func.label === "string" ? func.label : undefined;
      }

      // If functionName is not set, prompt the user to pick one
      if (!functionName) {
        const functions = await cli.functionsList(workspacePath);
        if (!functions || functions.length === 0) {
          vscode.window.showErrorMessage(
            "No functions found in this Dagger project.",
          );
          return;
        }
        const pick = await vscode.window.showQuickPick(
          functions.map((fn) => ({
            label: fn.name,
            description: fn.description || "",
          })),
          {
            placeHolder: "Select a function to save as a task",
            ignoreFocusOut: true,
          },
        );
        if (!pick) {
          return; // User cancelled
        }
        functionName = pick.label;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Dagger",
            cancellable: true,
          },
          async (progress, token) => {
            progress.report({ message: "Getting function arguments..." });

            // Get function arguments by finding the function in the functions list
            const functions = await cli.functionsList(workspacePath);
            const targetFunction = functions.find(
              (f) => f.name === functionName,
            );

            if (!targetFunction) {
              vscode.window.showErrorMessage(
                `Function "${functionName}" not found.`,
              );
              return;
            }

            const args = targetFunction.args || [];

            if (token.isCancellationRequested) {
              return;
            }

            progress.report({ message: "Collecting argument values..." });

            // Collect arguments and build task
            const result = await collectArgumentsForTask(targetFunction);
            if (result.cancelled) {
              return;
            }

            if (token.isCancellationRequested) {
              return;
            }

            progress.report({ message: "Saving task..." });

            // Save the task
            await saveTaskToTasksJson(
              result.taskName,
              result.command,
              workspacePath,
            );

            progress.report({ message: "Task saved successfully" });

            // Ask if user wants to run the task
            const shouldRun = await askToRunTask(result.taskName);
            if (shouldRun) {
              await runTask(result.taskName);
            }
          },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to save task: ${errorMessage}`);
        console.error("Error saving task:", error);
      }
    },
  );

  context.subscriptions.push(disposable);
};

interface TaskCreationResult {
  readonly taskName: string;
  readonly command: string;
  readonly cancelled: boolean;
}

/**
 * Collects function argument values and builds the command for saving as a task
 * @param func The function information including name, module, and arguments
 * @returns Task creation result with command string
 */
const collectArgumentsForTask = async (
  func: FunctionInfo,
): Promise<TaskCreationResult> => {
  const { name: functionName, args, module: moduleName } = func;

  // Handle the case where there are no arguments
  if (args.length === 0) {
    // Build the command using the utility function that handles module names properly
    const commandArgs = buildCommandArgs(functionName, {}, moduleName);
    const command = commandArgs.join(" ");

    // Get task name from user with default
    const defaultTaskName = `dagger-${functionName}`;
    const taskName = await vscode.window.showInputBox({
      prompt: "Enter a name for this VS Code task",
      value: defaultTaskName,
      validateInput: (input) => {
        return input ? undefined : "Task name is required";
      },
    });

    if (!taskName) {
      return { taskName: "", command: "", cancelled: true };
    }

    return { taskName, command, cancelled: false };
  }

  // Separate required and optional arguments
  const requiredArgs = args.filter((arg) => arg.required);
  const optionalArgs = args.filter((arg) => !arg.required);

  // Select optional arguments to include
  const selectedOptionalArgs = await selectOptionalArguments(optionalArgs);

  // Combine required and selected optional arguments
  const allSelectedArgs = [...requiredArgs, ...selectedOptionalArgs];

  // Collect values for all arguments
  const { argValues, cancelled } = await collectArgumentValues(allSelectedArgs);

  if (cancelled) {
    return { taskName: "", command: "", cancelled: true };
  }

  // Build the command using the utility function that handles module names properly
  const commandArgs = buildCommandArgs(functionName, argValues, moduleName);
  const command = commandArgs.join(" ");

  // Get task name from user with default
  const defaultTaskName = `dagger-${functionName}`;
  const taskName = await vscode.window.showInputBox({
    prompt: "Enter a name for this VS Code task",
    value: defaultTaskName,
    validateInput: (input) => {
      if (!input || input.trim() === "") {
        return "Task name cannot be empty";
      }
      // Basic validation for task name
      if (!/^[a-zA-Z0-9\-_\s]+$/.test(input)) {
        return "Task name can only contain letters, numbers, spaces, hyphens, and underscores";
      }
      return undefined;
    },
  });

  if (!taskName) {
    return { taskName: "", command: "", cancelled: true };
  }

  return { taskName: taskName.trim(), command, cancelled: false };
};

/**
 * Creates or updates the tasks.json file with a new Dagger task
 * @param taskName The name of the task
 * @param command The command to execute
 * @param workspacePath The workspace path
 */
export const saveTaskToTasksJson = async (
  taskName: string,
  command: string,
  workspacePath: string,
): Promise<void> => {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(workspacePath),
  );
  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
  const tasksJsonPath = path.join(vscodeDir, "tasks.json");

  // Ensure .vscode directory exists
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(vscodeDir));
  } catch {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodeDir));
  }

  let tasksConfig: any = {
    version: "2.0.0",
    tasks: [],
  };

  // Read existing tasks.json if it exists
  try {
    const existingContent = await vscode.workspace.fs.readFile(
      vscode.Uri.file(tasksJsonPath),
    );
    const existingText = Buffer.from(existingContent).toString("utf8");
    tasksConfig = JSON.parse(existingText);
  } catch {
    // File doesn't exist or is invalid, use default structure
  }

  // Ensure tasks array exists
  if (!Array.isArray(tasksConfig.tasks)) {
    tasksConfig.tasks = [];
  }

  // Create new task
  const newTask = {
    label: taskName,
    type: "shell",
    command: command,
    group: "build",
    presentation: {
      echo: true,
      reveal: "always",
      focus: false,
      panel: "shared",
      showReuseMessage: true,
      clear: false,
    },
    options: {
      cwd: "${workspaceFolder}",
    },
  };

  // Remove any existing task with the same label
  tasksConfig.tasks = tasksConfig.tasks.filter(
    (task: any) => task.label !== taskName,
  );

  // Add the new task
  tasksConfig.tasks.push(newTask);

  // Write back to tasks.json
  const updatedContent = JSON.stringify(tasksConfig, null, 2);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(tasksJsonPath),
    Buffer.from(updatedContent, "utf8"),
  );
};

/**
 * Asks the user if they want to run the newly saved task
 * @param taskName The name of the saved task
 * @returns True if user wants to run the task
 */
const askToRunTask = async (taskName: string): Promise<boolean> => {
  const choice = await vscode.window.showInformationMessage(
    `Task "${taskName}" has been saved successfully. Would you like to run it now?`,
    "Yes",
    "No",
  );
  return choice === "Yes";
};

/**
 * Runs a VS Code task by name
 * @param taskName The name of the task to run
 */
const runTask = async (taskName: string): Promise<void> => {
  const tasks = await vscode.tasks.fetchTasks();
  const task = tasks.find((t) => t.name === taskName);

  if (task) {
    await vscode.tasks.executeTask(task);
  } else {
    vscode.window.showErrorMessage(
      `Task "${taskName}" not found. You may need to reload the window for new tasks to be available.`,
    );
  }
};
