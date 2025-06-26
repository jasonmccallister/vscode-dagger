import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';

interface SdkOption {
    readonly label: string;
    readonly value: string;
}

type DevelopChoice = 'Yes' | 'No';
type FunctionsChoice = 'Yes' | 'No';

const SDK_OPTIONS: readonly SdkOption[] = [
    { label: 'Go', value: 'go' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'PHP', value: 'php' },
    { label: 'Python', value: 'python' },
    { label: 'Java', value: 'java' },
] as const;

/**
 * Gets the current workspace directory
 * @returns The workspace directory path
 */
const getWorkspaceDirectory = (): string => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0 
        ? workspaceFolders[0].uri.fsPath 
        : process.cwd();
};

/**
 * Handles the case where workspace is already a Dagger project
 * @param cli The Dagger CLI instance
 * @returns Promise that resolves when handling is complete
 */
const handleExistingProject = async (cli: Cli): Promise<void> => {
    const choice = await vscode.window.showErrorMessage(
        'This workspace is already a Dagger project. Do you want to run the "Dagger: Develop" command instead?',
        { modal: true },
        'Yes',
        'No'
    ) as DevelopChoice | undefined;

    if (choice === 'Yes') {
        await cli.run(['develop']);
    } else {
        vscode.window.showInformationMessage('You can run the "Dagger: Develop" command to start developing your Dagger project.');
    }
};

/**
 * Initializes a new Dagger project with selected SDK
 * @param cli The Dagger CLI instance
 * @param sdk The selected SDK option
 * @returns Promise that resolves when initialization is complete
 */
const initializeProject = async (cli: Cli, sdk: SdkOption): Promise<void> => {
    try {
        const cwd = getWorkspaceDirectory();
        const result = await cli.run(['init', '--sdk', sdk.value], { cwd });
        
        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${result.stderr}`);
            return;
        }

        // Ask the user if they want to see available functions
        const choice = await vscode.window.showInformationMessage(
            `Dagger project initialized with ${sdk.label} SDK! Would you like to see the available functions?`,
            { modal: true },
            'Yes',
            'No'
        ) as FunctionsChoice | undefined;

        if (choice === 'Yes') {
            await vscode.commands.executeCommand('dagger.functions');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${errorMessage}`);
    }
};

export const registerInitCommand = (context: vscode.ExtensionContext): void => {
    const cli = new Cli();
    const disposable = vscode.commands.registerCommand('dagger.init', async () => {
        // Ensure Dagger CLI is installed
        if (!await cli.isInstalled()) {
            await askToInstall();
            return;
        }

        // Check if this workspace is already a Dagger project
        if (await cli.isDaggerProject()) {
            await handleExistingProject(cli);
            return;
        }

        // Select SDK for new project
        const sdkChoice = await vscode.window.showQuickPick(SDK_OPTIONS, { 
            placeHolder: 'Select the SDK to use' 
        });

        if (!sdkChoice) {
            // User cancelled the selection
            return;
        }

        await initializeProject(cli, sdkChoice);
    });

    context.subscriptions.push(disposable);
};