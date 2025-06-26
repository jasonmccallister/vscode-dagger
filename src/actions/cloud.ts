import * as vscode from 'vscode';
import Cli from '../dagger/dagger';

type CloudPromptResponse = 'Sign up' | 'Learn More' | "Don't show again";

interface CloudTokenSources {
    readonly secretToken: string | undefined;
    readonly envToken: string | undefined;
}

/**
 * Checks if cloud tokens are available from various sources
 * @param context The extension context
 * @returns Object containing available tokens
 */
const getCloudTokenSources = async (context: vscode.ExtensionContext): Promise<CloudTokenSources> => {
    const secretToken = await context.secrets.get('dagger.cloudToken');
    const envToken = process.env.DAGGER_CLOUD_TOKEN;
    
    return { secretToken, envToken };
};

/**
 * Determines if cloud notification should be shown
 * @param config The workspace configuration
 * @param tokens The available cloud tokens
 * @param cliInstalled Whether the CLI is installed
 * @returns true if notification should be shown
 */
const shouldShowCloudNotification = (
    config: vscode.WorkspaceConfiguration,
    { secretToken, envToken }: CloudTokenSources,
    cliInstalled: boolean
): boolean => {
    const notificationDismissed = config.get<boolean>('cloudNotificationDismissed', false);
    
    // Don't show if token is available or notification was dismissed or CLI not installed
    return !secretToken && !envToken && !notificationDismissed && cliInstalled;
};

/**
 * Handles the cloud prompt response
 * @param response The user's response
 * @param config The workspace configuration
 */
const handleCloudPromptResponse = async (
    response: CloudPromptResponse | undefined,
    config: vscode.WorkspaceConfiguration
): Promise<void> => {
    switch (response) {
        case 'Sign up':
            await vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
            break;
            
        case 'Learn More':
            await vscode.env.openExternal(vscode.Uri.parse('https://docs.dagger.io/cloud'));
            break;
            
        case "Don't show again":
            await config.update('cloudNotificationDismissed', true, vscode.ConfigurationTarget.Global);
            break;
            
        // No response - do nothing
    }
};

/**
 * Check if Dagger Cloud token is available and show setup notification if needed
 */
export const promptCloud = async (context: vscode.ExtensionContext, cli: Cli): Promise<void> => {
    const config = vscode.workspace.getConfiguration('dagger');
    const tokens = await getCloudTokenSources(context);
    const cliInstalled = await cli.isInstalled();

    if (!shouldShowCloudNotification(config, tokens, cliInstalled)) {
        return;
    }

    // Show notification about Dagger Cloud setup
    const response = await vscode.window.showInformationMessage(
        'Setup Dagger Cloud to get better observability and collaboration features for your Dagger projects.',
        'Sign up',
        'Learn More',
        "Don't show again"
    ) as CloudPromptResponse | undefined;

    await handleCloudPromptResponse(response, config);
};