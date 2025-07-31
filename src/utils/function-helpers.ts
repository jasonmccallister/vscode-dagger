import * as vscode from "vscode";
import {
  executeTaskAndWait,
  TaskExecutionResult,
} from "./terminal";
import { DaggerSettings } from "../settings";
import { saveTaskToTasksJson } from "../commands/saveFunctionAsTask";
import { FunctionArgument, FunctionInfo } from "../types/types";

interface ArgumentPick {
  readonly label: string;
  readonly description: string;
  readonly detail: string;
}

interface CollectArgumentsResult {
  readonly argValues: Record<string, string>;
  readonly cancelled: boolean;
}

/**
 * Collects argument values from user input
 * @param args The function arguments to collect values for
 * @returns Object containing collected argument values and cancellation status
 */
export const collectArgumentValues = async (
  args: readonly FunctionArgument[],
): Promise<CollectArgumentsResult> => {
  const argValues: Record<string, string> = {};

  for (const arg of args) {
    const value = await vscode.window.showInputBox({
      prompt: `Enter value for --${arg.name} (${arg.type})${
        arg.required ? " [required]" : ""
      }`,
      ignoreFocusOut: true,
      validateInput: (input) =>
        arg.required && !input ? "This value is required." : undefined,
    });

    if (arg.required && !value) {
      vscode.window.showErrorMessage(
        `Value required for argument --${arg.name}`,
      );
      return { argValues: {}, cancelled: true };
    }

    if (value) {
      argValues[arg.name] = value;
    }
  }

  return { argValues, cancelled: false };
};

/**
 * Selects optional arguments from a list
 * @param optionalArgs The optional arguments to choose from
 * @returns Selected optional arguments
 */
export const selectOptionalArguments = async (
  optionalArgs: readonly FunctionArgument[],
): Promise<readonly FunctionArgument[]> => {
  if (optionalArgs.length === 0) {
    return [];
  }

  const argsPicks: readonly ArgumentPick[] = optionalArgs.map((arg) => ({
    label: `${arg.name} (${arg.type})`,
    description: "Optional",
    detail: `Type: ${arg.type}`,
  }));

  const selected = await vscode.window.showQuickPick(argsPicks, {
    placeHolder: "Select optional arguments to provide values for",
    canPickMany: true,
  });

  if (!selected) {
    return [];
  }

  const selectedNames = selected.map((arg) => arg.label.split(" ")[0]);
  return optionalArgs.filter((arg) => selectedNames.includes(arg.name));
};

/**
 * Builds command arguments array from collected values
 * @param functionName The function name to call
 * @param argValues The collected argument values
 * @param moduleName Optional module name for non-root modules
 * @returns Command arguments array
 */
export const buildCommandArgs = (
  functionName: string,
  argValues: Record<string, string>,
  moduleName?: string,
): string[] => {
  // Start with base command
  const commandArgs = ["dagger", "call"];

  // If a module name is provided and non-empty, add it before the function name
  if (moduleName && moduleName.length > 0) {
    commandArgs.push(moduleName, functionName);
  } else {
    // No module specified or empty module (parent module) - just use the function name
    commandArgs.push(functionName);
  }

  // Add all collected arguments to the command array, quoting values with spaces
  Object.entries(argValues).forEach(([name, value]) => {
    // Quote the value if it contains spaces or special shell characters
    const safeValue = /[\s"'\\$`]/.test(value)
      ? `"${value.replace(/(["\\$`])/g, "\\$1")}"`
      : value;
    commandArgs.push(`--${name}`, safeValue);
  });

  return commandArgs;
};

/**
 * Represents the collected function input data
 */
export interface CollectedFunctionInput {
  /** The name of the function */
  functionName: string;
  /** The module name (if applicable) */
  moduleName?: string;
  /** The return type of the function */
  returnType: string;
  /** The parent module name (if applicable) */
  parentModule?: string;
  /** The collected argument values */
  argValues: Record<string, string>;
  /** The final command arguments */
  commandArgs: string[];
}

/**
 * Collects function argument values and options from the user
 * @param token Cancellation token to allow cancellation of the operation
 * @param context VS Code extension context
 * @param functionInfo The function information including name, arguments, and module
 * @returns A promise that resolves to the collected function input or undefined if cancelled
 */
export const collectFunctionInput = async (
  token: vscode.CancellationToken,
  functionInfo: FunctionInfo,
): Promise<CollectedFunctionInput | undefined> => {
  const {
    name: functionName,
    args,
    module: moduleName,
    returnType,
    parentModule,
  } = functionInfo;

  // Check if operation has been cancelled
  if (token.isCancellationRequested) {
    return undefined;
  }

  // Separate required and optional arguments
  const requiredArgs = args.filter((arg) => arg.required);
  const optionalArgs = args.filter((arg) => !arg.required);

  // Select optional arguments to include
  const selectedOptionalArgs = await selectOptionalArguments(optionalArgs);

  // Check if operation has been cancelled
  if (token.isCancellationRequested) {
    return undefined;
  }

  // Combine required and selected optional arguments
  const allSelectedArgs = [...requiredArgs, ...selectedOptionalArgs];

  // Collect values for all arguments
  const { argValues, cancelled } = await collectArgumentValues(allSelectedArgs);

  if (cancelled || token.isCancellationRequested) {
    return undefined;
  }

  let commandArgs: string[];
  // if this is the root module, don't include module name
  if (functionInfo.parentModule === undefined) {
    commandArgs = buildCommandArgs(functionName, argValues);
  } else {
    commandArgs = buildCommandArgs(functionName, argValues, moduleName);
  }

  // Check if operation has been cancelled
  if (token.isCancellationRequested) {
    return undefined;
  }

  return {
    functionName,
    moduleName,
    returnType,
    parentModule,
    argValues,
    commandArgs,
  };
};

/**
 * Executes a Dagger function with the collected input
 * @param token Cancellation token
 * @param workspacePath The workspace path where the command will be executed
 * @param input The collected function input
 * @returns The task execution result along with command arguments and values
 */
export const runFunction = async (
  token: vscode.CancellationToken,
  workspacePath: string,
  input: CollectedFunctionInput,
): Promise<{
  Result: TaskExecutionResult;
  commandArgs: string[];
  argValues: Record<string, string>;
}> => {
  // Check if operation has been cancelled
  if (token.isCancellationRequested) {
    return {
      Result: { success: false, exitCode: 1, execution: undefined },
      commandArgs: input.commandArgs,
      argValues: input.argValues,
    };
  }

  // Execute the command as a task and wait for completion
  const result = await executeTaskAndWait(token, input.commandArgs.join(" "), {
    taskName: `dagger`,
    workingDirectory: workspacePath,
  });

  return {
    Result: {
      success: result.success,
      exitCode: result.exitCode,
      execution: result.execution,
    },
    commandArgs: input.commandArgs,
    argValues: input.argValues,
  };
};

/**
 * Shows a notification after a Dagger function call, prompting to save as a task
 * @param functionName The name of the function called
 * @param argValues The argument values used in the call
 * @param workspacePath The workspace path
 * @param settings The Dagger settings
 * @param moduleName Optional module name for non-root modules
 */
export const showSaveTaskPrompt = async (
  functionName: string,
  argValues: Record<string, string>,
  workspacePath: string,
  settings: DaggerSettings,
  moduleName?: string,
): Promise<void> => {
  // Use settings instead of directly accessing configuration
  if (settings.saveTaskPromptDismissed) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `Would you like to save this Dagger function call as a VS Code task?`,
    "Save",
    "Not now",
    "Don't show again",
  );

  if (choice === "Save") {
    // Ask for task name
    const defaultTaskName = `dagger-${functionName}`;
    const taskName = await vscode.window.showInputBox({
      prompt: "Enter a name for this VS Code task",
      value: defaultTaskName,
      validateInput: (input) => {
        if (!input || input.trim() === "") {
          return "Task name cannot be empty";
        }
        if (!/^[a-zA-Z0-9\-_\s]+$/.test(input)) {
          return "Task name can only contain letters, numbers, spaces, hyphens, and underscores";
        }
        return undefined;
      },
    });
    if (!taskName) {
      return;
    }

    // Build the command
    // TODO(jasonmccallister): handle the logic for parent modules to ensure the command is not appended
    // with the parent module name if its the root or only module
    const commandArgs = buildCommandArgs(functionName, argValues, moduleName);

    // Save the task using existing logic
    await saveTaskToTasksJson(
      taskName.trim(),
      commandArgs.join(" "),
      workspacePath,
    );
    vscode.window.showInformationMessage(
      `Task "${taskName.trim()}" saved! You can run it from the Run Task menu.`,
    );
  } else if (choice === "Don't show again") {
    await settings.update(
      "saveTaskPromptDismissed",
      true,
      vscode.ConfigurationTarget.Global,
    );
  }
};

/**
 * Interface for quick pick items that carry function info
 */
interface FunctionQuickPickItem extends vscode.QuickPickItem {
  functionInfo: FunctionInfo;
}

/**
 * Type definition for a function filter callback
 * @param fn The function info to filter
 * @returns True if the function should be included, false to exclude
 */
export type FunctionFilterCallback = (fn: FunctionInfo) => boolean;

/**
 * Shows a quick pick UI for selecting a function from a list
 *
 * @param functions The list of functions to choose from
 * @param filterCallback Optional callback to filter functions based on specific properties
 * @returns The selected function details or undefined if cancelled
 */
export const showSelectFunctionQuickPick = async (
  functions: FunctionInfo[],
  filterCallback?: FunctionFilterCallback,
): Promise<FunctionInfo | undefined> => {
  if (functions.length === 0) {
    vscode.window.showInformationMessage("No functions available to select.");
    return undefined;
  }

  const filteredFunctions = filterCallback
    ? functions.filter(filterCallback)
    : functions;

  const choices: FunctionQuickPickItem[] = filteredFunctions.map((fn) => ({
    id: fn.functionId,
    label: fn.name,
    description: `${fn.module ? `(${fn.module}) ` : ""}${fn.description ? fn.description : ""}`,
    detail: fn.returnType ? `Returns: ${fn.returnType}` : undefined,
    functionInfo: fn, // Store the actual function info object
  }));

  const selected = await vscode.window.showQuickPick(choices, {
    placeHolder: "Select a function",
  });

  return selected?.functionInfo;
};

/**
 * Creates a filter callback that matches functions based on a specific property and one or more values
 * @param propertyName The name of the property to filter by
 * @param values One or more values to match against - can be a single value or an array
 * @returns A filter callback function that can be passed to selectFunction
 */
export const createPropertyFilter = <K extends keyof FunctionInfo>(
  propertyName: K,
  values: FunctionInfo[K] | FunctionInfo[K][],
): FunctionFilterCallback => {
  // If values is a single value, convert to array for consistent processing
  const valueArray = Array.isArray(values) ? values : [values];

  // Return a function that checks if the property value is in our array of accepted values
  return (fn: FunctionInfo): boolean => valueArray.includes(fn[propertyName]);
};

/**
 * Creates a custom filter callback using a predicate function
 * @param predicate A function that tests each function info object
 * @returns A filter callback function that can be passed to selectFunction
 */
export const createCustomFilter = (
  predicate: (fn: FunctionInfo) => boolean,
): FunctionFilterCallback => {
  return predicate;
};
