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

    /**
     * Search with fallback to example data for testing/development
     * This method will try the real API first, then fall back to example data
     */
    public async searchDocsWithFallback(query: string): Promise<SearchResponse> {
        const result = await this.searchDocs(query);

        if (typeof result === 'string') {
            // API call failed, return example data for testing
            console.warn('API call failed, using example data:', result);
            return {
                query,
                count: exampleSearchData.count,
                data: exampleSearchData.data.map(item => ({
                    ...item,
                    title: item.title.replace('default arg', query) // Customize for the query
                }))
            };
        }

        return result;
    }
}

// Example search result data for testing
const exampleSearchData: SearchResponse = {
    query: "default arg",
    count: 57,
    data: [
        {
            title: "34-https://docs.dagger.io/api/arguments/",
            url: "https://docs.dagger.io/api/arguments/#default-values",
            snippet: ""
        },
        {
            title: "1-https://docs.dagger.io/api/arguments/",
            url: "https://docs.dagger.io/api/arguments/",
            snippet: "Dagger Functions, just like regular functions, can accept arguments. In addition to basic types (string, boolean, integer, arrays...), Dagger also defines powerful core types which Dagger Functions ca..."
        },
        {
            title: "19-https://docs.dagger.io/api/default-paths/",
            url: "https://docs.dagger.io/api/default-paths/#for-all-other-cases",
            snippet: "Outside context directory; error\\r\\nIf the default path is an absolute path / (or /src), the context directory is the directory containing dagger.json (say, /my-module). The resolved path will then be /..."
        }
    ]
};

/**
 * Utility function to create a ChatParticipant and process search results
 * This can be used when you have search result data to display
 */
export const createChatParticipantWithResults = (searchData: SearchResponse): { participant: ChatParticipant; formattedResults: string } => {
    const participant = new ChatParticipant();
    const formattedResults = participant.processSearchResults(searchData);
    return { participant, formattedResults };
};

/**
 * Example usage with actual search results
 * This demonstrates how to use the search functionality with real data
 */
export const demonstrateSearch = (): void => {
    const { participant, formattedResults } = createChatParticipantWithResults(exampleSearchData);
    console.log('Formatted search results:');
    console.log(formattedResults);
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
 * Chat request handler for VS Code chat participant
 * Streams search results directly to the chat UI
 */
export const chatRequestHandler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
) => {
    const query = request.prompt.trim();
    if (!query) {
        stream.markdown('Please enter a search query.');
        return;
    }
    const participant = new ChatParticipant();
    const result = await participant.searchDocs(query);
    if (typeof result === 'string') {
        stream.markdown(result);
    } else {
        stream.markdown(participant.formatSearchResults(result));
    }
};
