import * as vscode from 'vscode';
import DaggerCli from '../cli';

export async function loadTasks(cli: DaggerCli) {
    // if not installed return early
    if (!await cli.isInstalled()) {
        return;
    }

    // make sure the workspace is a Dagger project
    if (!await cli.isDaggerProject()) {
        return;
    }

    // get the current workspace path
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

    const functions = await cli.functionsList(workspacePath);
    if (!functions) {
        return;
    }

    vscode.tasks.registerTaskProvider('dagger', {
        provideTasks: async (token: vscode.CancellationToken) => {
            const tasks: vscode.Task[] = await Promise.all(functions.map(async fn => {
                const args = await cli.getFunctionArguments(fn.name, workspacePath);

                // Create simple task definition without input variables
                const taskDefinition = {
                    type: 'dagger',
                    function: fn.name,
                    args: args.map(arg => ({
                        name: arg.name,
                        type: arg.type,
                        required: arg.required
                    }))
                };

                // Create a base command - we'll handle arg collection separately
                const command = `dagger call ${fn.name}`;

                // Create the ShellExecution with the basic command
                const execution = new vscode.ShellExecution(
                    command,
                    { cwd: workspacePath }
                );

                // Create our task with a custom execution that first collects arguments
                const task = new vscode.Task(
                    taskDefinition,
                    vscode.TaskScope.Workspace,
                    fn.name,
                    'Dagger',
                    execution
                );
                task.group = vscode.TaskGroup.Build;
                task.presentationOptions = {
                    reveal: vscode.TaskRevealKind.Always, // Always show output
                    echo: true,
                    focus: true, // Focus on terminal
                    panel: vscode.TaskPanelKind.Shared
                };
                task.isBackground = false;
                task.problemMatchers = ["$dagger-matcher"];

                // Add custom execution callback - this gets run when the task is executed
                // @ts-ignore - this is a custom property
                task.runTaskCommand = async () => {
                    // For each argument, collect a value from the user
                    const argValues: Record<string, string> = {};
                    for (const arg of args) {
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

                    // Build the full command with collected args
                    const argString = Object.entries(argValues)
                        .map(([name, value]) => `--${name} ${value}`)
                        .join(' ');

                    // Update the execution command with collected args
                    const finalCommand = `${command}${argString ? ' ' + argString : ''}`;

                    // Run the command in the terminal
                    const terminal = vscode.window.createTerminal(`Dagger: ${fn.name}`);
                    terminal.show();
                    terminal.sendText(finalCommand);
                    return true; // Task completed successfully
                };
                return task;
            }));
            return tasks;
        },
        resolveTask(task: vscode.Task): vscode.Task | undefined {
            const functionName = task.definition.function;
            if (functionName && typeof functionName === 'string') {
                // This is one of our tasks, resolve it properly
                return task;
            }
            return undefined;
        }
    });
}