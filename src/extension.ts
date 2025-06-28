import * as vscode from 'vscode';
import { registerTreeView } from './tree/provider';
import { checkInstallation, InstallResult } from './utils/installation';
import { promptCloud } from './actions/cloud';
import Cli from './dagger/dagger';
import * as os from 'os';
import { registerCallCommand } from './commands/call';
import { registerCloudCommand } from './commands/cloud';
import { registerDevelopCommand } from './commands/develop';
import { registerFunctionsCommand } from './commands/functions';
import { registerInitCommand } from './commands/init';
import { registerInstallCommand } from './commands/install';
import { registerInstallModuleCommand } from './commands/install-module';
import { registerResetCommand } from './commands/reset';
import { registerSaveTaskCommand } from './commands/save-task';
import { registerShellCommand } from './commands/shell';
import { registerUninstallCommand } from './commands/uninstall';
import { registerUpdateCommand } from './commands/update';
import { registerVersionCommand } from './commands/version';
import { chatRequestHandler } from './chat/participant';
import { CHAT_PARTICIPANT_ID, EXTENSION_NAME } from './const';

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Register install command first (always needed regardless of installation status)
		registerInstallCommand(context);

		// Register chat participant for chat UI
		if ('chat' in vscode && typeof vscode.chat.createChatParticipant === 'function') {
			vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, chatRequestHandler);
		}

		// Check installation status before setting up other commands and views
		const installResult = await checkInstallation(os.platform());

		if (!installResult.hasCorrectBinary) {
			// Show installation prompt but don't register install command again
			await handleMissingInstallation(context, installResult);
			return;
		}

		// Dagger is properly installed, proceed with full activation
		await activateExtension(context);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to activate Dagger extension: ${error}`);
		// Install command already registered above
	}
}

const activateExtension = async (context: vscode.ExtensionContext): Promise<void> => {
	// Create CLI instance and get workspace path
	const cli = new Cli();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

	// Set workspace path for CLI if available
	if (workspacePath) {
		cli.setWorkspacePath(workspacePath);
	}

	// (install command already registered in activate function)
	registerUpdateCommand(context, cli);
	registerUninstallCommand(context);
	registerVersionCommand(context, cli);
	registerInitCommand(context, cli);
	registerDevelopCommand(context, cli, workspacePath);
	registerCloudCommand(context, cli);
	registerFunctionsCommand(context);
	registerResetCommand(context);
	registerShellCommand(context, workspacePath);
	registerCallCommand(context, cli, workspacePath);
	registerInstallModuleCommand(context, cli);
	registerSaveTaskCommand(context, cli, workspacePath);

	// Register tree view for environments with CLI and workspace path
	registerTreeView(context, { cli, workspacePath, registerTreeCommands: true });

	// Show cloud setup notification if appropriate
	promptCloud(context, cli);
};

const handleMissingInstallation = async (context: vscode.ExtensionContext, installResult: InstallResult): Promise<void> => {
	// Still register tree view to show installation status
	const cli = new Cli();
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
	} else {
		vscode.window.showWarningMessage(`Install skipped, you can install using \`${EXTENSION_NAME}: Install CLI\`.`);
	}
};