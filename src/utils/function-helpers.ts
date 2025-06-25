import * as vscode from 'vscode';
import Terminal from '../terminal';
import { FunctionArgument } from '../dagger/dagger';

/**
 * Collects function argument values from the user and executes the Dagger function
 * @param functionName The name of the function to call
 * @param args The function arguments
 * @returns A promise that resolves when the function is called or rejects if cancelled
 */
export async function collectAndRunFunction(
    functionName: string,
    args: FunctionArgument[],
): Promise<boolean> {
    // Separate required and optional arguments
    const requiredArgs = args.filter(arg => arg.required);
    const optionalArgs = args.filter(arg => !arg.required);

    // Show a quick pick for optional arguments if not already provided
    let selectedOptionalArgs: FunctionArgument[] = [];
    if (optionalArgs.length > 0) {
        const argsPicks = optionalArgs.map(arg => ({
            label: `${arg.name} (${arg.type})`,
            description: 'Optional',
            detail: `Type: ${arg.type}`
        }));
        
        const selected = await vscode.window.showQuickPick(argsPicks, {
            placeHolder: 'Select optional arguments to provide values for',
            canPickMany: true
        });
        
        if (selected) {
            const selectedNames = selected.map(arg => arg.label.split(' ')[0]);
            selectedOptionalArgs = optionalArgs.filter(arg => selectedNames.includes(arg.name));
        }
    }

    // Combine required and selected optional arguments
    const allSelectedArgs = [...requiredArgs, ...selectedOptionalArgs];
    
    // Collect values for all arguments
    const argValues: Record<string, string> = {};
    for (const arg of allSelectedArgs) {
        const value = await vscode.window.showInputBox({
            prompt: `Enter value for --${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
            ignoreFocusOut: true,
            validateInput: input => arg.required && !input ? 'This value is required.' : undefined
        });

        if (arg.required && !value) {
            vscode.window.showErrorMessage(`Value required for argument --${arg.name}`);
            return false; // Don't proceed with the task
        }

        if (value) {
            argValues[arg.name] = value;
        }
    }

    // Build the command as an array of arguments
    const commandArgs = ['call', functionName];

    // Add all collected arguments to the command array
    Object.entries(argValues).forEach(([name, value]) => {
        commandArgs.push(`--${name}`);
        commandArgs.push(value);
    });

    // Execute the function
    Terminal.run(
        vscode.workspace.getConfiguration('dagger'),
        commandArgs,
    );

    return true;
}
