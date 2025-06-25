import * as vscode from 'vscode';

/**
 * Chat participant for @dagger that searches docs.dagger.io for module development info.
 */
export class DaggerChatParticipant {
    public readonly name = '@dagger';
    public readonly description = 'Searches docs.dagger.io for information on developing Dagger modules.';

    async searchDocs(query: string): Promise<string> {
        // Use VS Code's fetch API or Node fetch to get docs.dagger.io search results
        // For demo, just return a formatted search URL
        const searchUrl = `https://docs.dagger.io/search?q=${encodeURIComponent(query)}`;
        return `You can find information about "${query}" here: ${searchUrl}`;
    }
}

// Example command registration (for integration with chat UI)
export function registerDaggerChatCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.chat.searchDocs', async () => {
            // Check if experimental features are enabled
            const config = vscode.workspace.getConfiguration('dagger');
            const experimentalFeaturesEnabled = config.get<boolean>('experimentalFeatures', false);
            
            if (!experimentalFeaturesEnabled) {
                const enableResponse = await vscode.window.showInformationMessage(
                    'This is an experimental feature. Would you like to enable experimental features?',
                    'Enable',
                    'Cancel'
                );
                
                if (enableResponse === 'Enable') {
                    await config.update('experimentalFeatures', true, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Experimental features enabled. Please reload the window for changes to take effect.');
                }
                return;
            }
            
            const query = await vscode.window.showInputBox({ prompt: 'Ask @dagger (docs.dagger.io):' });
            if (!query) { return; }
            const participant = new DaggerChatParticipant();
            const result = await participant.searchDocs(query);
            vscode.window.showInformationMessage(result);
        })
    );
}
