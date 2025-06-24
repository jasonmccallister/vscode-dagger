import * as vscode from 'vscode';


const windowName = 'Dagger';

export default function showTerminal(
    config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
): vscode.Terminal {
    const windowName = 'Dagger';
    let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === windowName);
    if (!terminal) {
        terminal = vscode.window.createTerminal(windowName);
    }

    // Always show and focus the terminal when this function is called
    terminal.show(true);

    return terminal;
}

export class Terminal {
    public static run(
        config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('dagger'),
        commands: string[],
        forceShow: boolean = false,
    ): vscode.Terminal {
        let terminal: vscode.Terminal | undefined = vscode.window.terminals.find(t => t.name === windowName);
        if (!terminal) {
            terminal = vscode.window.createTerminal(windowName);
        }

        const shouldExecute = config.get<boolean>('autoExecute', true);
        if (config.get('showTerminal') === 'always' || shouldExecute === false || forceShow) {
            terminal.show(true);
        }

        // add dagger as the first command if not already present
        if (commands[0] !== 'dagger') {
            commands.unshift('dagger');
        }

        // Always prefix with 'dagger call' when using the terminal
        terminal.sendText(commands.join(' '), config.get('autoExecute', shouldExecute));

        return terminal;
    }
}