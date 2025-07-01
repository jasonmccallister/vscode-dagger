import * as vscode from 'vscode';
import { registerTreeView } from './tree/provider';
import { checkInstallation, InstallResult } from './utils/installation';
import Cli from './dagger';
import * as os from 'os';
import { chatRequestHandler } from './chat/participant';
import { CHAT_PARTICIPANT_ID, EXTENSION_NAME } from './const';
import CommandManager from './commands';
import { registerTerminalProvider } from './terminal';

export async function activate(context: vscode.ExtensionContext) {
	try {
		const cli = new Cli();

		const commandManager = new CommandManager({
			context,
			cli: cli,
			workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
		});

		// only register install command if no CLI is found
		commandManager.register(false);

		// Register chat participant for chat UI
		if ('chat' in vscode && typeof vscode.chat.createChatParticipant === 'function') {
			vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, chatRequestHandler);
		}

		// Check installation status before setting up other commands and views
		const installResult = await checkInstallation(os.platform());

		if (!installResult.hasCorrectBinary) {
			// Show installation prompt but don't register install command again
			await handleMissingInstallation(context, commandManager.cli, installResult);
			return;
		}

		// Dagger is properly installed, proceed with full activation
		commandManager.register(true);

		// register the terminal profile provider
		registerTerminalProvider(context);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to activate Dagger extension: ${error}`);
		// Install command already registered above
	}
}

const handleMissingInstallation = async (context: vscode.ExtensionContext, cli: Cli, installResult: InstallResult): Promise<void> => {
	// Still register tree view to show installation status
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
	registerTreeView(context, { cli, workspacePath, registerTreeCommands: false });

	// Determine available installation methods for the prompt
	const installButtons: { title: string; command: string; method?: string }[] = [];
	if (installResult.hasHomebrew && (installResult.platform === 'darwin' || installResult.platform === 'linux')) {
		installButtons.push({ title: 'Homebrew (recommended)', command: 'dagger.install', method: 'brew' });
	}
	installButtons.push({ title: 'Curl script', command: `dagger.install`, method: 'curl' });

	// Show installation prompt with buttons
	const selectedButton = await vscode.window.showInformationMessage(
		`${EXTENSION_NAME} is not installed or not properly configured. Please select an installation method:`,
		...installButtons.map(button => button.title)
	);

	const selectedOption = installButtons.find(button => button.title === selectedButton);
	if (selectedOption) {
		await vscode.commands.executeCommand(selectedOption.command, selectedOption.method);
		return;
	}

	vscode.window.showWarningMessage(`Install skipped, you can install using \`${EXTENSION_NAME}: Install CLI\`.`);
};