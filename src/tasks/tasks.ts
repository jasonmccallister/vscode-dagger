import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { collectAndRunFunction } from '../utils/function-helpers';

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
        provideTasks: async (_: vscode.CancellationToken) => {
            const tasks: vscode.Task[] = await Promise.all(functions.map(async fn => {
                const args = await cli.getFunctionArguments(fn.name, workspacePath);

                // Create simple task definition 
                const taskDefinition = {
                    type: 'dagger',
                    function: fn.name
                };

                // TODO(jasonmccallister): this is hacky as VS Code will always show a pseudoterminal, 
                // even if you don't write any output. There is no official way to prevent the 
                // pseudoterminal from appearing when using CustomExecution
                const execution = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                    return {
                        onDidWrite: new vscode.EventEmitter<string>().event,
                        open: async () => {
                            // Prompt for arguments and run in the Dagger terminal
                            await collectAndRunFunction(fn.name, args);
                        },
                        close: () => { },
                        handleInput: () => { }
                    };
                });

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