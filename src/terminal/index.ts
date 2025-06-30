import * as vscode from 'vscode';
import { execFileSync } from 'child_process';
import * as path from 'path';


/**
 * Registers a terminal profile provider for Dagger.
 * This allows users to create a terminal with a specific profile.
 *
 * @param context - The extension context provided by VS Code.
 */
export const registerTerminalProvider = (context: vscode.ExtensionContext) => {
    const iconFile = context.asAbsolutePath('images/icon-white.png');
    const iconPath = {
        light: vscode.Uri.file(iconFile),
        dark: vscode.Uri.file(iconFile)
    };

    let daggerPath = '';
    try {
        daggerPath = execFileSync('which', ['dagger'], { encoding: 'utf8' }).trim();
    } catch (err) {
        vscode.window.showWarningMessage('Dagger binary not found in PATH. The Dagger Shell will not launch.');
    }

    const terminalProvider: vscode.TerminalProfileProvider = {
        provideTerminalProfile: async (_token: vscode.CancellationToken): Promise<vscode.TerminalProfile | undefined> => {
            if (!daggerPath) {
                return undefined;
            }
            return new vscode.TerminalProfile({
                name: 'Dagger Shell',
                iconPath,
                isTransient: true,
                shellPath: daggerPath,
            });
        }
    };

    context.subscriptions.push(
        vscode.window.registerTerminalProfileProvider('dagger.terminal-profile', terminalProvider)
    );
};