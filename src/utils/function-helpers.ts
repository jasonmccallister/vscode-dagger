import * as vscode from 'vscode';
import Terminal from '../terminal';
import { FunctionArgument } from '../dagger/dagger';

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
const collectArgumentValues = async (args: readonly FunctionArgument[]): Promise<CollectArgumentsResult> => {
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
const selectOptionalArguments = async (optionalArgs: readonly FunctionArgument[]): Promise<readonly FunctionArgument[]> => {
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
const buildCommandArgs = (functionName: string, argValues: Record<string, string>): readonly string[] => {
    const commandArgs = ['call', functionName];

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
 * @returns A promise that resolves to true if successful, false if cancelled
 */
export const collectAndRunFunction = async (
    functionName: string,
    args: readonly FunctionArgument[],
): Promise<boolean> => {
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
        return false;
    }

    // Build and execute the command
    const commandArgs = buildCommandArgs(functionName, argValues);
    Terminal.run(
        vscode.workspace.getConfiguration('dagger'),
        commandArgs,
    );

    return true;
};
