import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
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
 * Finds a valid shell executable path, with fallbacks for resilience
 * @returns A valid shell path for spawning processes
 * @description Tries to use the shell from environment variable, then falls back to common Unix shells
 */
export const findValidShell = (): string => {
  // Default shell from environment or common default
  let shell = process.env.SHELL || "/bin/bash";
  
  // Common fallback shells in order of preference
  const fallbackShells = ["/bin/bash", "/bin/zsh", "/bin/sh"];
  
  try {
    // Check if the default shell exists
    if (!fs.existsSync(shell)) {
      // Try fallback shells in order
      for (const fallbackShell of fallbackShells) {
        if (fs.existsSync(fallbackShell)) {
          shell = fallbackShell;
          break;
        }
      }
    }
    
    // Special handling for fish shell - it has different command execution behavior
    // For CLI processes, it's often better to use bash for compatibility
    if (shell.includes('fish')) {
      console.log('Fish shell detected, using bash for CLI commands for better compatibility');
      // Try to use bash instead for CLI commands
      if (fs.existsSync('/bin/bash')) {
        shell = '/bin/bash';
      } else if (fs.existsSync('/bin/zsh')) {
        shell = '/bin/zsh';
      } else if (fs.existsSync('/bin/sh')) {
        shell = '/bin/sh';
      }
    }
  } catch (err) {
    console.warn(`Error checking shell existence: ${err}`);
    shell = "/bin/sh"; // Safest fallback
  }
  
  return shell;
};

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
 * Executes a command in the Dagger terminal
 * @deprecated Use `executeTaskAndWait` for better task management
 */
export const executeInTerminal = async (
  context: vscode.ExtensionContext,
  command: string,
  isInteractive: boolean = false,
): Promise<void> => {
  // if this is interactive
  if (isInteractive) {
    const terminal = createTerminal(context);
    terminal.show();
    terminal.sendText(command);
    return;
  }

  const taskExecution = new vscode.ShellExecution(command);
  const taskDefinition: vscode.TaskDefinition = {
    type: "shell",
  };

  const task = new vscode.Task(
    taskDefinition,
    vscode.TaskScope.Workspace,
    TERMINAL_CONFIG.NAME,
    "shell",
    taskExecution,
  );

  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    showReuseMessage: false,
    clear: false,
  };
  task.detail = command;

  vscode.tasks.executeTask(task).then(
    () => {},
    (error) => {
      console.error(`Failed to execute command in terminal: ${command}`, error);
      vscode.window.showErrorMessage(
        `Failed to execute command: ${error.message}`,
      );
    },
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
    } = options || {};

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
