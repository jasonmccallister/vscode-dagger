import * as vscode from "vscode";
import * as path from "path";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";

const TERMINAL_CONFIG = {
  NAME: "Dagger",
  SHELL_INTEGRATION_TIMEOUT: 2000, // 2 seconds to check if terminal is busy
  CTRL_C: "\x03", // Control+C character
  CLEAR_SCREEN: "\x0c", // Form feed to clear screen
  CLEAR_LINE: "\x15", // NAK to clear current line
  EXIT_COMMAND: "exit",
} as const;

/**
 * Creates a terminal instance named "Dagger"
 * @param context The extension context to access resources
 * @returns A terminal instance named "Dagger"
 */
export const createTerminal = (
  context: vscode.ExtensionContext,
): vscode.Terminal => {
  return vscode.window.createTerminal({
    name: TERMINAL_CONFIG.NAME,
    iconPath: {
      light: vscode.Uri.file(path.join(context.extensionPath, ICON_PATH_BLACK)),
      dark: vscode.Uri.file(path.join(context.extensionPath, ICON_PATH_WHITE)),
    },
  });
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
    environment?: { [key: string]: string };
  },
): Promise<TaskExecutionResult> => {
  return new Promise((resolve, reject) => {
    // Check if already cancelled
    if (token.isCancellationRequested) {
      reject(new Error("Task execution was cancelled"));
      return;
    }

    const {
      runInBackground = false,
      taskName = TERMINAL_CONFIG.NAME,
      workingDirectory,
      environment,
    } = options || {};

    // Create environment variables
    // Note: We need to ensure all values are strings to satisfy the type requirements
    const env = environment 
      ? Object.fromEntries(
          Object.entries({ ...process.env, ...environment })
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)])
        ) 
      : undefined;

    const taskExecution = new vscode.ShellExecution(command, {
      cwd: workingDirectory,
      env,
    });

    const taskDefinition: vscode.TaskDefinition = {
      type: "shell",
    };

    const task = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      taskName,
      "shell",
      taskExecution,
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
      },
    );
  });
};
