import * as vscode from 'vscode';

const PREFIX = 'dagger' as const;

// Default search base URL - can be overridden via environment variable
const DEFAULT_BASE_URL = 'http://localhost:8888/.netlify/functions/search' as const;
const baseUrl = process.env.DAGGER_CODE_SEARCH_BASE_URL ?? DEFAULT_BASE_URL;

// Types for search results
interface SearchResultItem {
    readonly title: string;
    readonly url: string;
    readonly snippet: string;
}

interface SearchResponse {
    readonly query: string;
    readonly count: number;
    readonly data: readonly SearchResultItem[];
}

// Configuration constants
const CONFIG_KEY = 'experimentalFeatures' as const;
const COMMAND_ID = `${PREFIX}.chat.searchDocs` as const;
const REQUEST_TIMEOUT = 10000; // 10 seconds timeout

export class ChatParticipant {
    public readonly name = '@dagger';
    public readonly description = 'Searches docs.dagger.io for information on developing Dagger modules.';
    public readonly iconPath = vscode.extensions.getExtension('dagger')?.extensionPath + '/images/icon-white.png';

    async searchDocs(query: string): Promise<SearchResponse | string> {
        try {
            const searchUrl = `${baseUrl}?q=${encodeURIComponent(query)}`;

            // Create an AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            try {
                // Make actual HTTP request to search API with timeout
                const response = await fetch(searchUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Parse JSON response
                const data = await response.json() as SearchResponse;

                // Validate the response structure
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid response format - not a valid JSON object');
                }

                if (typeof data.query !== 'string' || typeof data.count !== 'number' || !Array.isArray(data.data)) {
                    throw new Error('Invalid response structure - missing required fields (query, count, data)');
                }

                // Validate each search result item
                const validatedData: SearchResultItem[] = data.data.filter((item): item is SearchResultItem => {
                    return item &&
                        typeof item.title === 'string' &&
                        typeof item.url === 'string' &&
                        typeof item.snippet === 'string';
                });

                // Return the validated search results
                const validatedResponse: SearchResponse = {
                    query: data.query,
                    count: data.count,
                    data: validatedData
                };

                return validatedResponse;

            } catch (fetchError) {
                clearTimeout(timeoutId);

                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    throw new Error('Request timeout - the search service is taking too long to respond');
                }

                throw fetchError;
            }

        } catch (error) {
            console.error('Error searching docs:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return `Failed to search for "${query}": ${errorMessage}`;
        }
    }

    /**
     * Processes search results from the API
     * This method can be used when you have actual search result data
     */
    public processSearchResults = (searchData: SearchResponse): string => {
        return this.formatSearchResults(searchData);
    };

    /**
     * Formats search results for display in VS Code
     */
    public formatSearchResults = (results: SearchResponse): string => {
        if (results.count === 0) {
            return `No results found for "${results.query}".`;
        }

        const maxResults = 5;
        const topResults = results.data.slice(0, maxResults);

        const header = `Found ${results.count} results for "${results.query}":\n`;

        const formattedResults = topResults
            .map((result, index) => {
                const title = result.title.replace(/^\d+-/, ''); // Remove number prefix
                const snippet = result.snippet ?
                    `\n   ${result.snippet.substring(0, 150)}${result.snippet.length > 150 ? '...' : ''}` :
                    '';
                return `${index + 1}. **${title}**\n   ${result.url}${snippet}`;
            })
            .join('\n\n');

        const footer = results.count > maxResults ?
            `\n\n... and ${results.count - maxResults} more results` :
            '';

        return `${header}\n${formattedResults}${footer}`;
    };
}

/**
 * Utility function to create a ChatParticipant and process search results
 * This can be used when you have search result data to display
 */
export const createChatParticipantWithResults = (searchData: SearchResponse): { participant: ChatParticipant; formattedResults: string } => {
    const participant = new ChatParticipant();
    const formattedResults = participant.processSearchResults(searchData);
    return { participant, formattedResults };
};

// Example command registration (for integration with chat UI)
export const registerChatCommand = (context: vscode.ExtensionContext): void => {
    // Only register the legacy command for palette/manual invocation
    const disposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
        // Check if experimental features are enabled
        const config = vscode.workspace.getConfiguration('dagger');
        const experimentalFeaturesEnabled = config.get<boolean>(CONFIG_KEY, false);

        if (!experimentalFeaturesEnabled) {
            const enableResponse = await vscode.window.showInformationMessage(
                'This is an experimental feature. Would you like to enable experimental features?',
                'Enable',
                'Cancel'
            );

            if (enableResponse === 'Enable') {
                await config.update(CONFIG_KEY, true, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Experimental features enabled. Please reload the window for changes to take effect.');
            }
            return;
        }

        const query = await vscode.window.showInputBox({
            prompt: 'Ask @dagger (docs.dagger.io):',
            placeHolder: 'Enter your search query...'
        });

        if (!query?.trim()) {
            return;
        }

        const participant = new ChatParticipant();
        const result = await participant.searchDocs(query.trim());

        // Handle both string (error messages) and SearchResponse (success) return types
        let message: string;
        if (typeof result === 'string') {
            // Error message returned
            message = result;
        } else {
            // SearchResponse object returned - format it for display
            message = participant.formatSearchResults(result);
        }

        vscode.window.showInformationMessage(message);
    });

    context.subscriptions.push(disposable);
};

/**
 * Conversational chat handler for Dagger documentation search
 * Summarizes the user's question, calls the search API, and explains or provides links.
 */
export const chatRequestHandler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
) => {
    // 1. Summarize the user's question into a search query
    let searchQuery = request.prompt.trim();
    if (!searchQuery) {
        stream.markdown('Please enter a question or topic to search.');
        return;
    }

    // If a language model is available, use it to summarize the question
    let summary = '';
    if (request.model && typeof vscode.LanguageModelChatMessage !== 'undefined') {
        const BASE_PROMPT = 'Summarize the following user question into a concise search query for Dagger documentation:';
        const messages = [
            vscode.LanguageModelChatMessage.User(BASE_PROMPT),
            vscode.LanguageModelChatMessage.User(request.prompt)
        ];
        try {
            const chatResponse = await request.model.sendRequest(messages, {}, token);
            for await (const fragment of chatResponse.text) {
                summary += fragment;
            }
            if (summary.trim()) {
                searchQuery = summary.trim();
            }
        } catch (err) {
            // If LLM fails, just use the original prompt
            summary = '';
        }
    }

    // 2. Call the search API with the summarized query
    const participant = new ChatParticipant();
    const result = await participant.searchDocs(searchQuery);

    // 3. If results are relevant, explain them; otherwise, provide links
    if (typeof result !== 'string' && result.count > 0 && result.data.length > 0) {
        // Try to explain the results if the model is available
        let explanation = '';
        if (request.model && typeof vscode.LanguageModelChatMessage !== 'undefined') {
            const explainPrompt = `Explain these Dagger documentation search results to a user who asked: "${request.prompt}"\n\nResults:\n${participant.formatSearchResults(result)}`;
            const messages = [
                vscode.LanguageModelChatMessage.User(explainPrompt)
            ];
            try {
                const chatResponse = await request.model.sendRequest(messages, {}, token);
                for await (const fragment of chatResponse.text) {
                    stream.markdown(fragment);
                }
                // Also provide links for reference
                stream.markdown('\n**Relevant documentation:**');
                for (const item of result.data.slice(0, 5)) {
                    stream.markdown(`- [${item.title.replace(/^\d+-/, '')}](${item.url})`);
                }
                return;
            } catch (err) {
                // If LLM fails, fall back to links
            }
        }
        // If no model or explanation fails, just provide links
        stream.markdown('Here are some relevant documentation pages that may help:');
        for (const item of result.data.slice(0, 5)) {
            stream.markdown(`- [${item.title.replace(/^\d+-/, '')}](${item.url})`);
        }
        return;
    }

    // 4. Fallback: No results or error
    if (typeof result === 'string') {
        stream.markdown(result);
    } else {
        stream.markdown('Sorry, I could not find relevant documentation for your question.');
        if (result.data && result.data.length > 0) {
            stream.markdown('Here are a few pages that might be helpful:');
            for (const item of result.data.slice(0, 3)) {
                stream.markdown(`- [${item.title.replace(/^\d+-/, '')}](${item.url})`);
            }
        }
    }
};
