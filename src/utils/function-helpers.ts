import * as vscode from 'vscode';
import { FunctionArgument } from '../dagger/dagger';
import { executeInTerminal } from './terminal';
import { saveTaskToTasksJson } from '../commands/save-task';

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
export const collectArgumentValues = async (args: readonly FunctionArgument[]): Promise<CollectArgumentsResult> => {
    const argValues: Record<string, string> = {};

    for (const arg of args) {
        const value = await vscode.window.showInputBox({
            prompt: `Enter value for --${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
            ignoreFocusOut: true,
            validateInput: input => arg.required && !input ? 'This value is required.' : undefined
        });

        if (arg.required && !value) {
            vscode.window.showErrorMessage(`Value required for argument --${arg.name}`);
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
export const selectOptionalArguments = async (optionalArgs: readonly FunctionArgument[]): Promise<readonly FunctionArgument[]> => {
    if (optionalArgs.length === 0) {
        return [];
    }

    const argsPicks: readonly ArgumentPick[] = optionalArgs.map(arg => ({
        label: `${arg.name} (${arg.type})`,
        description: 'Optional',
        detail: `Type: ${arg.type}`
    }));

    const selected = await vscode.window.showQuickPick(argsPicks, {
        placeHolder: 'Select optional arguments to provide values for',
        canPickMany: true
    });

    if (!selected) {
        return [];
    }

    const selectedNames = selected.map(arg => arg.label.split(' ')[0]);
    return optionalArgs.filter(arg => selectedNames.includes(arg.name));
};

/**
 * Builds command arguments array from collected values
 * @param functionName The function name to call
 * @param argValues The collected argument values
 * @returns Command arguments array
 */
export const buildCommandArgs = (functionName: string, argValues: Record<string, string>): readonly string[] => {
    const commandArgs = ['dagger', 'call', functionName];

    // Add all collected arguments to the command array
    Object.entries(argValues).forEach(([name, value]) => {
        commandArgs.push(`--${name}`, value);
    });

    return commandArgs;
};

/**
 * Collects function argument values from the user and executes the Dagger function
 * @param functionName The name of the function to call
 * @param args The function arguments
 * @returns A promise that resolves to { success, argValues } where argValues are the used arguments
 */
export const collectAndRunFunction = async (
    functionName: string,
    args: readonly FunctionArgument[],
): Promise<{ success: boolean, argValues: Record<string, string> }> => {
    // Separate required and optional arguments
    const requiredArgs = args.filter(arg => arg.required);
    const optionalArgs = args.filter(arg => !arg.required);

    // Select optional arguments to include
    const selectedOptionalArgs = await selectOptionalArguments(optionalArgs);

    // Combine required and selected optional arguments
    const allSelectedArgs = [...requiredArgs, ...selectedOptionalArgs];

    // Collect values for all arguments
    const { argValues, cancelled } = await collectArgumentValues(allSelectedArgs);

    if (cancelled) {
        return { success: false, argValues: {} };
    }

    // Build and execute the command
    const commandArgs = buildCommandArgs(functionName, argValues);

    executeInTerminal(commandArgs.join(' '));

    return { success: true, argValues };
};

/**
 * Shows a notification after a Dagger function call, prompting to save as a task
 * @param functionName The name of the function called
 * @param argValues The argument values used in the call
 * @param workspacePath The workspace path
 */
export const showSaveTaskPrompt = async (
    functionName: string,
    argValues: Record<string, string>,
    workspacePath: string
): Promise<void> => {
    const config = vscode.workspace.getConfiguration('dagger');
    const dismissed = config.get<boolean>('saveTaskPromptDismissed', false);
    if (dismissed) { return; }

    const choice = await vscode.window.showInformationMessage(
        `Would you like to save this Dagger function call as a VS Code task?`,
        'Save',
        'Not now',
        "Don't show again"
    );

    if (choice === 'Save') {
        // Ask for task name
        const defaultTaskName = `dagger-${functionName}`;
        const taskName = await vscode.window.showInputBox({
            prompt: 'Enter a name for this VS Code task',
            value: defaultTaskName,
            validateInput: (input) => {
                if (!input || input.trim() === '') {
                    return 'Task name cannot be empty';
                }
                if (!/^[a-zA-Z0-9\-_\s]+$/.test(input)) {
                    return 'Task name can only contain letters, numbers, spaces, hyphens, and underscores';
                }
                return undefined;
            }
        });
        if (!taskName) { return; }
        // Build the command
        const commandArgs = buildCommandArgs(functionName, argValues);
        const command = commandArgs.join(' ');
        // Save the task using existing logic
        await saveTaskToTasksJson(taskName.trim(), command, workspacePath);
        vscode.window.showInformationMessage(`Task "${taskName.trim()}" saved! You can run it from the Run Task menu.`);
    } else if (choice === "Don't show again") {
        await config.update('saveTaskPromptDismissed', true, vscode.ConfigurationTarget.Global);
    }
    // 'Not now' does nothing (prompt will show again next time)
};
