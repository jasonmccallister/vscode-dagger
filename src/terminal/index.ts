import * as vscode from 'vscode';
import { execFileSync } from 'child_process';
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from '../const';

/**
 * Function type for finding the Dagger binary path
 */
export type DaggerPathFinder = () => string;

/**
 * Default implementation of the Dagger path finder
 * @returns The path to the Dagger binary or empty string if not found
 */
export const findDaggerPath = (): string => {
    try {
        return execFileSync('which', ['dagger'], { encoding: 'utf8' }).trim();
    } catch (err) {
        return '';
    }
};

/**
 * Registers a terminal profile provider for Dagger.
 * This allows users to create a terminal with a specific profile.
 *
 * @param context - The extension context provided by VS Code.
 * @param pathFinder - Optional function to find the Dagger binary path
 */
export const registerTerminalProvider = (
    context: vscode.ExtensionContext,
    pathFinder: DaggerPathFinder = findDaggerPath
): void => {
    const iconPath = {
        light: vscode.Uri.file(context.asAbsolutePath(ICON_PATH_BLACK)),
        dark: vscode.Uri.file(context.asAbsolutePath(ICON_PATH_WHITE))
    };

    const daggerPath = pathFinder();
    
    if (!daggerPath) {
        vscode.window.showWarningMessage('Dagger binary not found in PATH. The Dagger Shell will not launch.');
        return;
    }

    const terminalProvider: vscode.TerminalProfileProvider = {
        provideTerminalProfile: async (_token: vscode.CancellationToken): Promise<vscode.TerminalProfile | undefined> => {
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