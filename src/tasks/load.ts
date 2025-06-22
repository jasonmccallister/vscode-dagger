import * as vscode from 'vscode';
import DaggerCli from '../cli';

// // example output of the functions starts at:
// Name             Description
// container-echo   Returns a container that echoes whatever string argument is provided
// grep-dir         Returns lines that match a pattern in the files of the provided Directory

export async function provideDaggerTasks(): Promise<vscode.Task[]> {
    const cli = new DaggerCli();
    if (!(await cli.isDaggerProject())) {
        vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
        return [];
    }

    // Run 'dagger functions' and parse output
    const result = await cli.run(['functions']);
    if (!result.success) {
        vscode.window.showErrorMessage('Failed to list Dagger functions: ' + result.stderr);
        return [];
    }

    // Find the header line and only process lines after it
    const header = /^Name\s+Description$/i;
    const lines = result.stdout.split(/\r?\n/);
    const headerIndex = lines.findIndex(line => header.test(line.trim()));
    if (headerIndex === -1) {
        vscode.window.showErrorMessage('Could not find Dagger functions header in output.');
        return [];
    }
    const functionLines = lines.slice(headerIndex + 1).filter(line => line.trim().length > 0 && /\S+\s{2,}\S+/.test(line));
    const tasks: vscode.Task[] = [];
    for (const line of functionLines) {
        // Split by two or more spaces to separate name and description
        const [name, ...descParts] = line.split(/\s{2,}/);
        if (!name || descParts.length === 0) continue; // skip malformed lines
        const taskName = name.trim();
        const taskDesc = descParts.join(' ').trim();
        const exec = new vscode.ShellExecution(`dagger ${taskName}`);
        const task = new vscode.Task(
            { type: 'dagger', task: taskName },
            vscode.TaskScope.Workspace,
            taskName,
            'dagger',
            exec,
            []
        );
        task.detail = taskDesc;
        tasks.push(task);
    }
    return tasks;
}

// Example: register the provider
export function registerDaggerTaskProvider(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider('dagger', {
            provideTasks: provideDaggerTasks,
            resolveTask(_task: vscode.Task): vscode.Task | undefined {
                return undefined;
            }
        })
    );
}
