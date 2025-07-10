import * as vscode from "vscode";
import * as path from "path";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";

interface ButtonConfig {
  readonly command: string;
  readonly title: string;
  readonly arguments?: any[];
}

interface FollowupSuggestion {
  readonly prompt: string;
  readonly title: string;
}

const FOLLOWUP_SUGGESTIONS: FollowupSuggestion[] = [
  {
    prompt: "How do I create a new Dagger module?",
    title: "Creating a new module",
  },
  {
    prompt: "Show me Dagger module examples",
    title: "View examples",
  },
];

/**
 * Generates search results response for the chat
 * @param query The search query
 * @param stream The chat response stream
 */
const generateSearchResponse = async (
  query: string,
  stream: vscode.ChatResponseStream
): Promise<void> => {
  const searchUrl = `https://docs.dagger.io/search?q=${encodeURIComponent(query)}`;

  // Show progress message
  stream.progress("Searching docs.dagger.io...");

  // Add a small delay to simulate searching
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Send markdown response with search results
  stream.markdown(
    `# Dagger Documentation Results\n\nI found information about "${query}" in the Dagger documentation.`
  );

  // Add a reference to the docs site
  const docsUri = vscode.Uri.parse("https://docs.dagger.io");
  stream.reference(docsUri);

  // Provide a link to the search results
  stream.markdown(
    `\n\nView the search results here: [docs.dagger.io/search](${searchUrl})`
  );

  // Add a button to open the search results in a browser
  const searchButton: ButtonConfig = {
    command: "vscode.open",
    title: "Open Search Results",
    arguments: [vscode.Uri.parse(searchUrl)],
  };
  stream.button(searchButton);
};

/**
 * Creates the chat request handler
 * @returns The chat request handler function
 */
const createChatHandler = (): vscode.ChatRequestHandler => {
  return async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ) => {
    // Extract the query from the request
    const query = request.prompt;
    await generateSearchResponse(query, stream);
  };
};

/**
 * Creates the followup provider
 * @returns The followup provider object
 */
const createFollowupProvider = (): vscode.ChatFollowupProvider => ({
  provideFollowups: () => FOLLOWUP_SUGGESTIONS,
});

/**
 * Sets up the chat participant icon
 * @param participant The chat participant
 * @param context The extension context
 */
const setupParticipantIcon = (
  participant: vscode.ChatParticipant,
  context: vscode.ExtensionContext
): void => {
  participant.iconPath = {
    light: vscode.Uri.file(path.join(context.extensionPath, ICON_PATH_BLACK)),
    dark: vscode.Uri.file(path.join(context.extensionPath, ICON_PATH_WHITE)),
  };
};

export const registerProvider = (context: vscode.ExtensionContext): void => {
  try {
    // Create the chat participant using the VS Code API
    const handler = createChatHandler();
    const participant = vscode.chat.createChatParticipant("dagger", handler);

    // Set the icon path to the extension's image
    setupParticipantIcon(participant, context);

    // Add follow-up suggestions
    participant.followupProvider = createFollowupProvider();

    // Log successful registration
    console.log("Dagger chat participant registered successfully");

    // Add participant to extension context
    context.subscriptions.push(participant);
  } catch (error) {
    // Log any errors that occur during registration
    console.error("Failed to register Dagger chat participant:", error);
  }
};
