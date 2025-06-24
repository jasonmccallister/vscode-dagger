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
                
                // Define task definition with dynamic inputs
                const taskDefinition = {
                    type: 'dagger',
                    function: fn.name,
                    inputs: args.map(arg => ({
                        id: `arg_${fn.name}_${arg.name}`,
                        description: `${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
                        default: '',
                        type: 'promptString'
                    }))
                };
                
                // Build command with input references
                const argStrings = args.map(arg => 
                    `--${arg.name} \${input:arg_${fn.name}_${arg.name}}`
                );
                const command = `dagger call ${fn.name} ${argStrings.join(' ')}`;
                
                // Create the ShellExecution with the command that includes input references
                const execution = new vscode.ShellExecution(
                    command, 
                    { cwd: workspacePath }
                );
                
                const task = new vscode.Task(
                    taskDefinition,
                    vscode.TaskScope.Workspace,
                    fn.name,
                    'Dagger',
                    execution
                );
                task.group = vscode.TaskGroup.Build;
                task.presentationOptions = {
                    reveal: vscode.TaskRevealKind.Silent,
                    echo: true,
                    focus: false,
                    panel: vscode.TaskPanelKind.Shared
                };
                task.isBackground = false;
                // Set up a problem matcher for better feedback
                task.problemMatchers = ["$dagger-matcher"];
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