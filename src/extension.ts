import * as vscode from 'vscode';
import DaggerCommands from './commands/commands';

export function activate(context: vscode.ExtensionContext) {
	const commands = new DaggerCommands(context);
}

export function deactivate() {}
