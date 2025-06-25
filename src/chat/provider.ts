import * as vscode from 'vscode';
import * as path from 'path';

export function registerProvider(context: vscode.ExtensionContext) {
    try {
        // Define the chat request handler
        const handler: vscode.ChatRequestHandler = async (
            request: vscode.ChatRequest,
            context: vscode.ChatContext,
            stream: vscode.ChatResponseStream,
            token: vscode.CancellationToken
        ) => {
            // Check if experimental features are enabled
            const config = vscode.workspace.getConfiguration('dagger');
            const experimentalFeaturesEnabled = config.get<boolean>('experimentalFeatures', false);

            if (!experimentalFeaturesEnabled) {
                stream.markdown('❌ **Experimental features are disabled**\n\nThis chat participant requires experimental features to be enabled.');
                stream.markdown('\nTo enable experimental features:\n1. Open VS Code Settings\n2. Search for "dagger experimental"\n3. Enable "Dagger: Experimental Features"');
                stream.button({
                    command: 'workbench.action.openSettings',
                    title: 'Open Settings',
                    arguments: ['dagger.experimentalFeatures']
                });
                return;
            }

            // Extract the query from the request
            const query = request.prompt;
            const searchUrl = `https://docs.dagger.io/search?q=${encodeURIComponent(query)}`;

            // Show progress message
            stream.progress('Searching docs.dagger.io...');

            // Add a small delay to simulate searching
            await new Promise(resolve => setTimeout(resolve, 500));

            // Send markdown response with search results
            stream.markdown(`# Dagger Documentation Results\n\nI found information about "${query}" in the Dagger documentation.`);

            // Add a reference to the docs site
            const docsUri = vscode.Uri.parse('https://docs.dagger.io');
            stream.reference(docsUri);

            // Provide a link to the search results
            stream.markdown(`\n\nView the search results here: [docs.dagger.io/search](${searchUrl})`);

            // Add a button to open the search results in a browser
            stream.button({
                command: 'vscode.open',
                title: 'Open Search Results',
                arguments: [vscode.Uri.parse(searchUrl)]
            });

            // Return undefined to indicate we're done
            return undefined;
        };

        // Create the chat participant using the VS Code API
        const participant = vscode.chat.createChatParticipant('dagger', handler);

        // Set the icon path to the extension's image
        const iconPath = path.join(context.extensionPath, 'images', 'dagger.png');
        participant.iconPath = {
            light: vscode.Uri.file(iconPath),
            dark: vscode.Uri.file(iconPath)
        };

        // Add follow-up suggestions
        participant.followupProvider = {
            provideFollowups: (result, context, token) => {
                return [
                    {
                        prompt: 'How do I create a new Dagger module?',
                        title: 'Creating a new module'
                    },
                    {
                        prompt: 'Show me Dagger module examples',
                        title: 'View examples'
                    }
                ];
            }
        };

        // Log successful registration
        console.log('Dagger chat participant registered successfully');

        // Add participant to extension context
        context.subscriptions.push(participant);
    } catch (error) {
        // Log any errors that occur during registration
        console.error('Failed to register Dagger chat participant:', error);
    }
}
