import * as vscode from "vscode";
import * as path from "path";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";
import { getGlobalSettings } from "../settings";

const TERMINAL_CONFIG = {
  NAME: "Dagger",
  SHELL_INTEGRATION_TIMEOUT: 2000, // 2 seconds to check if terminal is busy
  CTRL_C: "\x03", // Control+C character
  CLEAR_SCREEN: "\x0c", // Form feed to clear screen
  CLEAR_LINE: "\x15", // NAK to clear current line
  EXIT_COMMAND: "exit",
} as const;

/**
 * @deprecated use executeTaskAndWait instead
 * Executes a command in the Dagger terminal
 */
export const executeInTerminal = async (command: string): Promise<void> => {
  // Get global settings
  const settings = getGlobalSettings();

  // Default to false if settings are not available
  const runInBackground = settings?.runFunctionCallsInBackground ?? false;

  const taskExecution = new vscode.ShellExecution(command);
  const taskDefinition: vscode.TaskDefinition = {
    type: "shell",
  };

  const task = new vscode.Task(
    taskDefinition,
    vscode.TaskScope.Workspace,
    TERMINAL_CONFIG.NAME,
    "shell",
    taskExecution
  );

  task.presentationOptions = {
    reveal: runInBackground
      ? vscode.TaskRevealKind.Silent
      : vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    showReuseMessage: false,
    clear: false,
  };
  task.detail = command;
  task.isBackground = runInBackground;

  vscode.tasks.executeTask(task).then(
    () => {
      // only show the window if runInBackground is false
      if (!runInBackground) {
        vscode.window
          .showInformationMessage(`${command}`, "View Output")
          .then((selection) => {
            if (selection === "View Output") {
              const daggerTerminal = vscode.window.terminals.find(
                (t) => t.name === TERMINAL_CONFIG.NAME
              );
              if (daggerTerminal) {
                daggerTerminal.show();
                return;
              }

              // Get extension path for icons
              const extension = vscode.extensions.getExtension(
                "jasonmccallister.vscode-dagger"
              );
              const extensionPath = extension?.extensionPath;

              const newTerminal = vscode.window.createTerminal({
                name: TERMINAL_CONFIG.NAME,
                iconPath: extensionPath
                  ? {
                      light: vscode.Uri.file(
                        path.join(extensionPath, ICON_PATH_BLACK)
                      ),
                      dark: vscode.Uri.file(
                        path.join(extensionPath, ICON_PATH_WHITE)
                      ),
                    }
                  : undefined,
              });
              newTerminal.show();
              newTerminal.sendText(command);
            }
          });
      }
    },
    (error) => {
      console.error(`Failed to execute command in terminal: ${command}`, error);
      vscode.window.showErrorMessage(
        `Failed to execute command: ${error.message}`
      );
    }
  );
};

/**
 * Result interface for synchronous terminal execution
 */
export interface TerminalExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Result interface for task execution
 */
export interface TaskExecutionResult {
  success: boolean;
  exitCode: number | undefined;
  execution: vscode.TaskExecution | undefined;
}

/**
 * Executes a command in a VS Code task and waits for completion
 * @param command The command to execute
 * @param options Optional execution options
 * @returns Promise with execution results including status and exit code
 */
export const executeTaskAndWait = async (
  token: vscode.CancellationToken,
  command: string,
  options?: {
    runInBackground?: boolean;
    taskName?: string;
    workingDirectory?: string;
  }
): Promise<TaskExecutionResult> => {
  return new Promise((resolve, reject) => {
    // Check if already cancelled
    if (token.isCancellationRequested) {
      reject(new Error("Task execution was cancelled"));
      return;
    }

    const { runInBackground = false, taskName = TERMINAL_CONFIG.NAME, workingDirectory } =
      options || {};

    const taskExecution = new vscode.ShellExecution(command, {
      cwd: workingDirectory,
    });
    const taskDefinition: vscode.TaskDefinition = {
      type: "shell",
    };

    const task = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      taskName,
      "shell",
      taskExecution
    );

    task.presentationOptions = {
      reveal: runInBackground
        ? vscode.TaskRevealKind.Silent
        : vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Shared,
      showReuseMessage: false,
      clear: false,
    };
    task.detail = command;
    task.isBackground = runInBackground;
    task.group = vscode.TaskGroup.Build; // Group the task under Build

    let taskExecutionHandle: vscode.TaskExecution | undefined;

    // Set up cancellation token listener
    const cancellationDisposable = token.onCancellationRequested(() => {
      // Clean up event listeners
      processEndDisposable.dispose();
      taskEndDisposable.dispose();
      cancellationDisposable.dispose();
      
      // Terminate the task if it's running
      if (taskExecutionHandle) {
        taskExecutionHandle.terminate();
      }
      
      reject(new Error("Task execution was cancelled"));
    });

    // Set up event listeners before executing the task
    const processEndDisposable = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution.task === task) {
        processEndDisposable.dispose();
        taskEndDisposable.dispose();
        cancellationDisposable.dispose();

        resolve({
          success: event.exitCode === 0,
          exitCode: event.exitCode,
          execution: event.execution,
        });
      }
    });

    const taskEndDisposable = vscode.tasks.onDidEndTask((event) => {
      if (event.execution.task === task) {
        // This handles cases where the task ends but doesn't have a process
        // (e.g., tasks that don't execute an underlying process)
        processEndDisposable.dispose();
        taskEndDisposable.dispose();
        cancellationDisposable.dispose();

        resolve({
          success: true, // We can't determine success without exit code
          exitCode: undefined,
          execution: event.execution,
        });
      }
    });

    // Execute the task
    vscode.tasks.executeTask(task).then(
      (execution) => {
        // Store the execution handle for potential cancellation
        taskExecutionHandle = execution;
      },
      (error) => {
        processEndDisposable.dispose();
        taskEndDisposable.dispose();
        cancellationDisposable.dispose();
        reject(new Error(`Failed to execute task: ${error.message}`));
      }
    );
  });
};
