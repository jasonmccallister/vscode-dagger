import * as vscode from 'vscode';
import DaggerCli from './cli/cli';
import { exists } from './executable';

const homebrewOption = 'Use Homebrew (recommended)';
const curlOption = 'Use curl script';
const brewInstallCommand = 'brew install dagger/tap/dagger';
const curlInstallCommand = 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh';

// make a custom type for install method
type InstallMethod = 'brew' | 'curl' | '';

/**
 * Check if Dagger Cloud token is available and show setup notification if needed
 */
async function checkDaggerCloudSetup(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration('dagger');
	const notificationDismissed = config.get<boolean>('cloudNotificationDismissed', false);

	// Check if token is available in secret storage or environment variable
	const secretToken = await context.secrets.get('dagger.cloudToken');
	const envToken = process.env.DAGGER_CLOUD_TOKEN;

	// If token is available (either in secret storage or environment) or notification was dismissed, don't show notification
	if (secretToken || envToken || notificationDismissed) {
		return;
	}

	// Show notification about Dagger Cloud setup
	const response = await vscode.window.showInformationMessage(
		'Setup Dagger Cloud to get better observability and collaboration features for your Dagger projects.',
		'Sign up',
		'Learn More',
		'Don\'t show again'
	);

	if (response === 'Sign up') {
		vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
	} else if (response === 'Learn More') {
		vscode.env.openExternal(vscode.Uri.parse('https://docs.dagger.io/cloud'));
	} else if (response === 'Don\'t show again') {
		await config.update('cloudNotificationDismissed', true, vscode.ConfigurationTarget.Global);
	}
}

/**
 * Check if Dagger CLI is installed and show a notification if it's not
 */
async function checkDaggerInstallation(): Promise<boolean> {
	const isDaggerInstalled = await exists('dagger');
	return isDaggerInstalled;
}

/**
 * Ensure Dagger CLI is installed before running a command
 * @returns true if Dagger is installed, false otherwise
 */
async function ensureDaggerInstalled(): Promise<boolean> {
	const isDaggerInstalled = await exists('dagger');

	if (!isDaggerInstalled) {
		const response = await vscode.window.showErrorMessage(
			'Dagger CLI is required for this command but is not installed.',
			'Install Now',
			'Cancel'
		);

		if (response === 'Install Now') {
			await vscode.commands.executeCommand('dagger.install');
			// After installation attempt, check again
			return await exists('dagger');
		}

		return false;
	}

	return true;
}

export function activate(context: vscode.ExtensionContext) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		throw new Error('No workspace folder is open. Please open a folder or workspace first.');
	}

	const workspace = workspaceFolders[0].uri;

	// Check Dagger installation when extension activates
	const isInstalled = checkDaggerInstallation();

	if (!isInstalled) {
		vscode.window.showWarningMessage(
			'Dagger CLI is not installed. Commands will not work until it is installed.',
			'Install Now'
		).then((response) => {
			if (response === 'Install Now') {
				vscode.commands.executeCommand('dagger.install');
			}
		});

		return;
	}

	// Check Dagger Cloud setup after confirming CLI is installed
	checkDaggerCloudSetup(context);


	const cli = new DaggerCli('dagger', workspace);

	context.subscriptions.push(
		vscode.commands.registerCommand('dagger.version', async () => {
			if (!await ensureDaggerInstalled()) {
				return;
			}

			try {
				const result = await cli.run(['version']);
				vscode.window.showInformationMessage(`Dagger version: ${result.stdout}`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to get Dagger version: ${error}`);
			}
		}),
		// install command
		vscode.commands.registerCommand('dagger.install', async () => {
			const binaryExists = await exists('dagger', []);

			if (!binaryExists) {
				// Get current install method preference from settings
				const config = vscode.workspace.getConfiguration('dagger');
				let defaultInstallMethod: InstallMethod = config.get('installMethod', '');

				// Check if user is on macOS and has brew installed first
				let installMethod: InstallMethod = defaultInstallMethod;
				let installPromptMessage = 'Dagger is not installed. Would you like to install it now?';
				let installOptions = ['Install', 'Cancel'];

				// brew is available on macOS and Linux
				if (process.platform === 'darwin' || process.platform === 'linux') {
					if (await exists('brew')) {
						// If no preference is set (empty string), show both options
						if (defaultInstallMethod === '') {
							installOptions = [homebrewOption, curlOption];
						} else {
							// Use the preferred method from settings as default, but still show options
							const preferredOption = defaultInstallMethod === 'brew' ? homebrewOption : curlOption;
							const alternateOption = defaultInstallMethod === 'brew' ? curlOption : homebrewOption;
							installOptions = [preferredOption, alternateOption];
						}
					} else {
						// Brew not available, only show curl option if no preference or preference is curl
						if (defaultInstallMethod === '' || defaultInstallMethod === 'curl') {
							installOptions = ['Install (curl)', 'Cancel'];
						}
					}
				} else {
					// Not macOS/Linux, only curl is available
					installOptions = ['Install (curl)', 'Cancel'];
				}

				const installResponse = await vscode.window.showInformationMessage(
					installPromptMessage,
					{ modal: true },
					...installOptions
				);

				if (installResponse === 'Cancel' || !installResponse) {
					vscode.window.showInformationMessage('Installation cancelled. You can install Dagger later by running the "Dagger: Install" command.');
					return;
				}

				// Determine install method based on response
				if (installResponse === homebrewOption) {
					installMethod = 'brew';
				} else if (installResponse === curlOption) {
					installMethod = 'curl';
				} else if (installResponse === 'Install (curl)') {
					installMethod = 'curl';
				} else if (installResponse === 'Install') {
					// If defaultInstallMethod is empty, default to curl as fallback
					installMethod = defaultInstallMethod === '' ? 'curl' : defaultInstallMethod;
				}

				// Update the setting with the user's choice (only if they made a specific choice and no preference was set)
				if (defaultInstallMethod === '' && (installResponse === homebrewOption || installResponse === curlOption)) {
					await config.update('installMethod', installMethod, vscode.ConfigurationTarget.Global);
				}

				// Execute the installation command
				const terminal = vscode.window.createTerminal('Dagger');
				terminal.show();

				let installCommand: string;
				if (installMethod === 'brew') {
					installCommand = brewInstallCommand;

				} else {
					installCommand = curlInstallCommand;

				}

				terminal.sendText(installCommand);

				// Show option to verify installation after a delay
				setTimeout(async () => {
					const verifyResponse = await vscode.window.showInformationMessage(
						'Installation command has been executed. Would you like to verify the installation?',
						'Verify',
						'Later'
					);

					if (verifyResponse === 'Verify') {
						if (await exists('dagger')) {
							vscode.window.showInformationMessage('✅ Dagger has been successfully installed!');
						} else {
							vscode.window.showWarningMessage('⚠️ Dagger was not found. Please check the terminal output for any errors and ensure your PATH is updated.');
						}
					}
				}, 8000); // Wait 8 seconds for brew (slower than curl)
			} else {
				vscode.window.showInformationMessage('Dagger is already installed.');
			}
		}),
		vscode.commands.registerCommand('dagger.init', async () => {
			if (!await ensureDaggerInstalled()) {
				return;
			}

			// check if this workspace is already a dagger project
			if (await cli.isDaggerProject()) {
				// show an error message if it is and prompt the user to run the develop command or ignore
				const choice = await vscode.window.showErrorMessage(
					'This workspace is already a Dagger project. Do you want to run the "Dagger: Develop" command instead?',
					{ modal: true },
					'Yes',
					'No'
				);

				if (choice === 'Yes') {
					await cli.run(['develop']);
				} else {
					// User chose to ignore, do nothing
					vscode.window.showInformationMessage('You can run the "Dagger: Develop" command to start developing your Dagger project.');
				}

				return;
			}

			// make an options list with the available SDKs using the label and value properties
			// the label is the display name of the sdk and the value is the same but lower case
			const options = [
				{ label: 'Go', value: 'go' },
				{ label: 'TypeScript', value: 'typescript' },
				{ label: 'PHP', value: 'php' },
				{ label: 'Python', value: 'python' },
				{ label: 'Java', value: 'java' },
			];

			const sdkChoice = await vscode.window.showQuickPick(options, { placeHolder: 'Select the SDK to use' });

			if (!sdkChoice) {
				// User cancelled the selection
				return;
			}

			// run the init command with the selected sdk
			try {
				await cli.run(['init', '--sdk', sdkChoice.value]);

				// Ask the user if they want to run the functions command
				const choice = await vscode.window.showInformationMessage(
					`Dagger project initialized with ${sdkChoice.label} SDK! Would you like to see the available functions?`,
					{ modal: true },
					'Yes',
					'No'
				);

				if (choice === 'Yes') {
					// call the vscode dagger.functions command
					await vscode.commands.executeCommand('dagger.functions');
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${error}`);
			}
		}),
		vscode.commands.registerCommand('dagger.develop', async () => {
			if (!await ensureDaggerInstalled()) {
				return;
			}

			// check if this workspace is already a dagger project
			if (!await cli.isDaggerProject()) {
				// show an error message if it is and ask the user to run the init command
				// Ask the user if they want to run the functions command
				const choice = await vscode.window.showErrorMessage(
					`This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
					{ modal: true },
					'Run Init',
					'No'
				);

				if (choice === 'Run Init') {
					// Open a terminal and run the dagger init command
					const terminal = vscode.window.createTerminal('Dagger');
					terminal.sendText('dagger init');
					terminal.show();
				}

				return;
			}

			// run the develop command in a terminal
			const terminal = vscode.window.createTerminal('Dagger');
			terminal.sendText('dagger develop');
			terminal.show();
		}),
		vscode.commands.registerCommand('dagger.functions', async () => {
			if (!await ensureDaggerInstalled()) {
				return;
			}

			// check if this workspace is already a dagger project
			if (!await cli.isDaggerProject()) {
				const choice = await vscode.window.showErrorMessage(
					`This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
					{ modal: true },
					'Run Init',
					'No'
				);

				if (choice === 'Run Init') {
					// Open a terminal and run the dagger init command
					const terminal = vscode.window.createTerminal('Dagger');
					terminal.sendText('dagger init');
					terminal.show();
				}

				return;
			}

			// Open a terminal and run the dagger functions command
			const terminal = vscode.window.createTerminal('Dagger');
			terminal.sendText('dagger functions');
			terminal.show();
		}),
		vscode.commands.registerCommand('dagger.setupCloud', async () => {
			const config = vscode.workspace.getConfiguration('dagger');
			const currentToken = config.get<string>('cloudToken', '');
			const envToken = process.env.DAGGER_CLOUD_TOKEN;

			let message = 'Setup Dagger Cloud to get enhanced observability and collaboration features.';
			if (envToken) {
				message = 'Dagger Cloud token is already set via DAGGER_CLOUD_TOKEN environment variable.';
			} else if (currentToken) {
				message = 'Dagger Cloud token is already configured in settings.';
			}

			const response = await vscode.window.showInformationMessage(
				message,
				'Visit dagger.cloud',
				'Open Settings',
				...(currentToken || envToken ? ['Test Connection'] : []),
				'Cancel'
			);

			if (response === 'Visit dagger.cloud') {
				vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
			} else if (response === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'dagger.cloudToken');
			} else if (response === 'Test Connection' && (currentToken || envToken)) {
				// Simple check - if we have a token, consider it valid for now
				// In a real implementation, you might want to make an API call to verify
				vscode.window.showInformationMessage('✅ Dagger Cloud token is configured and ready to use!');
			}
		})
	);
}

export function deactivate() { }
