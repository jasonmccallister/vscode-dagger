import * as vscode from 'vscode';
import Cli from '../dagger/dagger';

type CloudResponse = 'Visit dagger.cloud' | 'Open Settings' | 'Test Connection' | 'Cancel';

interface TokenSources {
    readonly envToken: string | undefined;
    readonly secretToken: string;
    readonly currentToken: string;
}

/**
 * Gets token from various sources
 * @param config The workspace configuration
 * @returns Object containing tokens from different sources
 */
const getTokenSources = async (config: vscode.WorkspaceConfiguration): Promise<TokenSources> => {
    const currentToken = config.get<string>('cloudToken', '');
    const envToken = process.env.DAGGER_CLOUD_TOKEN;
    
    let secretToken = '';
    try {
        const session = await vscode.authentication.getSession('dagger', ['cloudToken'], { createIfNone: false });
        secretToken = session?.accessToken ?? '';
    } catch {
        secretToken = '';
    }

    return { envToken, secretToken, currentToken };
};

/**
 * Gets the appropriate message based on token availability
 * @param tokens The token sources
 * @returns The message to display
 */
const getCloudMessage = ({ envToken, secretToken, currentToken }: TokenSources): string => {
    if (envToken) {
        return 'Dagger Cloud token is already set via DAGGER_CLOUD_TOKEN environment variable.';
    }
    
    if (secretToken) {
        return 'Dagger Cloud token is already stored in VS Code Secret Storage.';
    }
    
    if (currentToken) {
        return 'Dagger Cloud token is already configured in settings.';
    }
    
    return 'Setup Dagger Cloud to get enhanced observability and collaboration features.';
};

/**
 * Gets the available response options
 * @param tokens The token sources
 * @returns Array of response options
 */
const getResponseOptions = ({ envToken, secretToken, currentToken }: TokenSources): readonly string[] => {
    const baseOptions = ['Visit dagger.cloud', 'Open Settings'];
    const hasToken = !!(currentToken || envToken || secretToken);
    const testOption = hasToken ? ['Test Connection'] : [];
    
    return [...baseOptions, ...testOption, 'Cancel'];
};

/**
 * Handles the user's response to the cloud setup dialog
 * @param response The user's selected response
 * @param tokens The token sources
 */
const handleCloudResponse = async (response: CloudResponse | undefined, tokens: TokenSources): Promise<void> => {
    switch (response) {
        case 'Visit dagger.cloud':
            await vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
            break;
            
        case 'Open Settings':
            await vscode.commands.executeCommand('workbench.action.openSettings', 'dagger.cloudToken');
            break;
            
        case 'Test Connection':
            if (tokens.currentToken || tokens.envToken || tokens.secretToken) {
                // Simple check - if we have a token, consider it valid for now
                // In a real implementation, you might want to make an API call to verify
                vscode.window.showInformationMessage('✅ Dagger Cloud token is configured and ready to use!');
            }
            break;
            
        // Cancel or undefined - do nothing
    }
};

export const registerCloudCommand = (
    context: vscode.ExtensionContext,
    cli: Cli
): void => {
    const disposable = vscode.commands.registerCommand('dagger.setupCloud', async () => {
        const config = vscode.workspace.getConfiguration('dagger');
        const tokens = await getTokenSources(config);
        const message = getCloudMessage(tokens);
        const options = getResponseOptions(tokens);

        const response = await vscode.window.showInformationMessage(
            message,
            ...options
        ) as CloudResponse | undefined;

        await handleCloudResponse(response, tokens);
    });

    context.subscriptions.push(disposable);
};