import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { registerDaggerChatCommand } from './chat/participant';
import { registerDaggerChatParticipant } from './chat/provide';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Dagger extension activating...');
	
	const cli = new DaggerCli();

	// Register core commands
	Commands.register(context, "", cli);

	// Show cloud prompt
	promptCloud(context, cli);

	// Chat functionality
	try {
		// Register dagger chat command for manual searching
		registerDaggerChatCommand(context);
		
		// Register dagger as a chat participant
		registerDaggerChatParticipant(context);
		
		console.log('Dagger chat features registered successfully');
	} catch (error) {
		console.error('Failed to register Dagger chat features:', error);
	}
	
	console.log('Dagger extension activated');
}