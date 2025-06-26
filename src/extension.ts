import * as vscode from 'vscode';
import { registerTreeView } from './tree/provider';
import { registerInstallCommand, registerAllCommands } from './commands';
import { checkInstallation, InstallResult } from './utils/installation';
import Cli from './dagger/dagger';
import * as os from 'os';

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Register install command first (always needed regardless of installation status)
		registerInstallCommand(context);
		
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

	// Register all other commands when Dagger is installed with dependency injection
	// (install command already registered in activate function)
	registerAllCommands(context, cli, workspacePath);

	// Register tree view for environments with CLI and workspace path
	registerTreeView(context, { cli, workspacePath, registerCommands: true });
};

const handleMissingInstallation = async (context: vscode.ExtensionContext, installResult: InstallResult): Promise<void> => {
	// Install command already registered in activate function

	// Still register tree view to show installation status
	const cli = new Cli();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
	registerTreeView(context, { cli, workspacePath, registerCommands: false });

	// Determine available installation methods for the prompt
	const installMethods: string[] = [];
	if (installResult.hasHomebrew && (installResult.platform === 'darwin' || installResult.platform === 'linux')) {
		installMethods.push('Homebrew (recommended)');
	}
	installMethods.push('curl script');

	const methodText = installMethods.length > 1
		? `Available installation methods: ${installMethods.join(', ')}`
		: `Installation method: ${installMethods[0]}`;

	// Show installation prompt
	const action = await vscode.window.showWarningMessage(
		`Dagger is not installed or not properly configured. ${methodText}`,
		'Install Now',
		'Install Later',
		'Learn More'
	);

	switch (action) {
		case 'Install Now':
			// Trigger the install command
			await vscode.commands.executeCommand('dagger.install');
			break;
		case 'Learn More':
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/dagger/dagger'));
			break;
		// 'Install Later' or no selection just continues without action
	}
};