import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { initProjectCommand } from '../actions/init';
import Terminal from '../terminal';

export const registerFunctionsCommand = (context: vscode.ExtensionContext): void => {
    const cli = new Cli();
    
    const disposable = vscode.commands.registerCommand('dagger.functions', async () => {
        // Check if this workspace is already a dagger project
        if (!(await cli.isDaggerProject())) {
            await initProjectCommand();
            return;
        }

        Terminal.run(
            vscode.workspace.getConfiguration('dagger'),
            ['functions'],
        );
    });

    context.subscriptions.push(disposable);
};