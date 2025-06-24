import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';

export async function activate(context: vscode.ExtensionContext) {
	const cli = new DaggerCli();

	Commands.register(context, "", cli);

	promptCloud(context, cli);
}