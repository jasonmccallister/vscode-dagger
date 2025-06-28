import * as vscode from 'vscode';
import * as path from 'path';
import Cli, { FunctionArgument } from '../dagger/dagger';

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
    const commandArgs = ['dagger', 'call', functionName];

    // Add all collected arguments to the command array
    Object.entries(argValues).forEach(([name, value]) => {
        commandArgs.push(`--${name}`, value);
    });

    return commandArgs;
};

export const SAVE_TASK_COMMAND = 'dagger.saveTask';

interface TaskCreationResult {
    readonly taskName: string;
    readonly command: string;
    readonly cancelled: boolean;
}

/**
 * Collects function argument values and builds the command for saving as a task
 * @param functionName The name of the function to call
 * @param args The function arguments
 * @returns Task creation result with command string
 */
const collectArgumentsForTask = async (
    functionName: string,
    args: readonly FunctionArgument[]
): Promise<TaskCreationResult> => {
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
        return { taskName: '', command: '', cancelled: true };
    }

    // Build the command
    const commandArgs = buildCommandArgs(functionName, argValues);
    const command = commandArgs.join(' ');

    // Get task name from user with default
    const defaultTaskName = `dagger-${functionName}`;
    const taskName = await vscode.window.showInputBox({
        prompt: 'Enter a name for this VS Code task',
        value: defaultTaskName,
        validateInput: (input) => {
            if (!input || input.trim() === '') {
                return 'Task name cannot be empty';
            }
            // Basic validation for task name
            if (!/^[a-zA-Z0-9\-_\s]+$/.test(input)) {
                return 'Task name can only contain letters, numbers, spaces, hyphens, and underscores';
            }
            return undefined;
        }
    });

    if (!taskName) {
        return { taskName: '', command: '', cancelled: true };
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
    workspacePath: string
): Promise<void> => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(workspacePath));
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
    const tasksJsonPath = path.join(vscodeDir, 'tasks.json');

    // Ensure .vscode directory exists
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(vscodeDir));
    } catch {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodeDir));
    }

    let tasksConfig: any = {
        version: '2.0.0',
        tasks: []
    };

    // Read existing tasks.json if it exists
    try {
        const existingContent = await vscode.workspace.fs.readFile(vscode.Uri.file(tasksJsonPath));
        const existingText = Buffer.from(existingContent).toString('utf8');
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
        type: 'shell',
        command: command,
        group: 'build',
        presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
            showReuseMessage: true,
            clear: false
        },
        options: {
            cwd: '${workspaceFolder}'
        }
    };

    // Remove any existing task with the same label
    tasksConfig.tasks = tasksConfig.tasks.filter((task: any) => task.label !== taskName);

    // Add the new task
    tasksConfig.tasks.push(newTask);

    // Write back to tasks.json
    const updatedContent = JSON.stringify(tasksConfig, null, 2);
    await vscode.workspace.fs.writeFile(
        vscode.Uri.file(tasksJsonPath),
        Buffer.from(updatedContent, 'utf8')
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
        'Yes',
        'No'
    );
    return choice === 'Yes';
};

/**
 * Runs a VS Code task by name
 * @param taskName The name of the task to run
 */
const runTask = async (taskName: string): Promise<void> => {
    const tasks = await vscode.tasks.fetchTasks();
    const task = tasks.find(t => t.name === taskName);
    
    if (task) {
        await vscode.tasks.executeTask(task);
    } else {
        vscode.window.showErrorMessage(`Task "${taskName}" not found. You may need to reload the window for new tasks to be available.`);
    }
};

export const registerSaveTaskCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {

    const disposable = vscode.commands.registerCommand(SAVE_TASK_COMMAND, async (func?: string | vscode.TreeItem) => {
        let functionName: string | undefined;

        // Support both string and TreeItem
        if (typeof func === 'string') {
            functionName = func;
        } else if (func && typeof func === 'object' && 'label' in func) {
            functionName = typeof func.label === 'string' ? func.label : undefined;
        }

        // If functionName is not set, prompt the user to pick one
        if (!functionName) {
            const functions = await cli.functionsList(workspacePath);
            if (!functions || functions.length === 0) {
                vscode.window.showErrorMessage('No functions found in this Dagger project.');
                return;
            }
            const pick = await vscode.window.showQuickPick(
                functions.map(fn => ({
                    label: fn.name,
                    description: fn.description || '',
                })),
                {
                    placeHolder: 'Select a function to save as a task',
                    ignoreFocusOut: true,
                }
            );
            if (!pick) {
                return; // User cancelled
            }
            functionName = pick.label;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Dagger',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: 'Getting function arguments...' });

                // Get function arguments
                const args = await cli.getFunctionArguments(functionName!, workspacePath);
                if (!args) {
                    vscode.window.showErrorMessage(`Failed to get arguments for function '${functionName}'`);
                    return;
                }

                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ message: 'Collecting argument values...' });

                // Collect arguments and build task
                const result = await collectArgumentsForTask(functionName!, args);
                if (result.cancelled) {
                    return;
                }

                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ message: 'Saving task...' });

                // Save the task
                await saveTaskToTasksJson(result.taskName, result.command, workspacePath);

                progress.report({ message: 'Task saved successfully' });

                // Ask if user wants to run the task
                const shouldRun = await askToRunTask(result.taskName);
                if (shouldRun) {
                    await runTask(result.taskName);
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save task: ${errorMessage}`);
            console.error('Error saving task:', error);
        }
    });

    context.subscriptions.push(disposable);
};
