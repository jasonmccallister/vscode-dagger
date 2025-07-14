import * as vscode from "vscode";
import {
  searchDocs as defaultSearchDocs,
  SearchResponse as ISearchResponse,
} from "./search";
import {
  CHAT_PARTICIPANT_NAME,
  CHAT_PARTICIPANT_DESCRIPTION,
  CHAT_PARTICIPANT_ICON_DEFAULT,
  EXTENSION_ID,
  ICON_PATH_WHITE,
  ICON_PATH_BLACK,
} from "../const";

const BASE_PROMPT = `Summarize the following user question into a concise search query for Dagger documentation (try to keep the query to two or three words):\nAlso, Dagger is about Dagger.io - not the dependency management tool from Google.`;

export class ChatParticipant {
  public readonly name = CHAT_PARTICIPANT_NAME;
  public readonly description = CHAT_PARTICIPANT_DESCRIPTION;
  public readonly sticky = true;
  public readonly iconPath:
    | string
    | vscode.ThemeIcon
    | { light: vscode.Uri; dark: vscode.Uri };
  private readonly _searchDocs: (
    query: string,
  ) => Promise<ISearchResponse | string>;

  constructor(
    searchDocsDep: (
      query: string,
    ) => Promise<ISearchResponse | string> = defaultSearchDocs,
    iconPath?:
      | string
      | vscode.ThemeIcon
      | { light: vscode.Uri; dark: vscode.Uri },
  ) {
    this._searchDocs = searchDocsDep;
    this.iconPath =
      iconPath ?? new vscode.ThemeIcon(CHAT_PARTICIPANT_ICON_DEFAULT);
  }

  public async searchDocs(query: string): Promise<ISearchResponse | string> {
    return this._searchDocs(query);
  }

  /**
   * Processes search results from the API
   * This method can be used when you have actual search result data
   */
  public processSearchResults = (searchData: ISearchResponse): string => {
    return this.formatSearchResults(searchData);
  };

  /**
   * Formats search results for display in VS Code
   */
  public formatSearchResults = (results: ISearchResponse): string => {
    if (results.count === 0) {
      return `No results found for "${results.query}".`;
    }

    const maxResults = 5;
    const topResults = results.data.slice(0, maxResults);

    let output = `Found ${results.count} results for "${results.query}":\n\n`;
    output += topResults
      .map((result) => {
        const title = result.title.replace(/^\d+-/, "");
        const url = result.url;
        const snippet = result.snippet
          ? result.snippet.substring(0, 200) +
            (result.snippet.length > 200 ? "..." : "")
          : "";
        return `- [${title}](${url})\n  ${snippet ? snippet : ""}`;
      })
      .join("\n\n");

    if (results.count > maxResults) {
      output += `\n\n... and ${results.count - maxResults} more results`;
    }

    return output;
  };
}

/**
 * Utility function to create a ChatParticipant and process search results
 * This can be used when you have search result data to display
 */
export const createChatParticipantWithResults = (
  searchData: ISearchResponse,
  iconPath?: string | vscode.ThemeIcon,
): { participant: ChatParticipant; formattedResults: string } => {
  const participant = new ChatParticipant(undefined, iconPath);
  const formattedResults = participant.processSearchResults(searchData);
  return { participant, formattedResults };
};

/**
 * Conversational chat handler for Dagger documentation search
 * Summarizes the user's question, calls the search API, and explains or provides links.
 */
export const chatRequestHandler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
) => {
  // 1. Summarize the user's question into a search query
  let searchQuery = request.prompt.trim();
  if (!searchQuery) {
    stream.markdown("Please enter a question or topic to search.");
    return;
  }

  // If a language model is available, use it to summarize the question
  let summary = "";
  if (request.model && typeof vscode.LanguageModelChatMessage !== "undefined") {
    const messages = [
      vscode.LanguageModelChatMessage.User(BASE_PROMPT),
      vscode.LanguageModelChatMessage.User(request.prompt),
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
      summary = "";
    }
  }

  // 2. Get the extension and icon path, then call the search API with the summarized query
  let iconPath:
    | string
    | vscode.ThemeIcon
    | vscode.Uri
    | { light: vscode.Uri; dark: vscode.Uri } = new vscode.ThemeIcon(
    CHAT_PARTICIPANT_ICON_DEFAULT,
  );
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (ext) {
    // Use theme-aware icon with light/dark variations
    iconPath = {
      light: vscode.Uri.joinPath(ext.extensionUri, ICON_PATH_BLACK),
      dark: vscode.Uri.joinPath(ext.extensionUri, ICON_PATH_WHITE),
    };
  }
  const participant = new ChatParticipant(undefined, iconPath);
  const result = await participant.searchDocs(searchQuery);

  // 3. If results are relevant, explain them; otherwise, provide links
  if (
    typeof result !== "string" &&
    result.count > 0 &&
    result.data.length > 0
  ) {
    // Try to explain the results if the model is available
    let explanation = "";
    if (
      request.model &&
      typeof vscode.LanguageModelChatMessage !== "undefined"
    ) {
      const explainPrompt = `Explain these Dagger documentation search results to a user who asked: "${request.prompt}"

Results:
${participant.formatSearchResults(result)}`;
      const messages = [vscode.LanguageModelChatMessage.User(explainPrompt)];
      try {
        const chatResponse = await request.model.sendRequest(
          messages,
          {},
          token,
        );
        for await (const fragment of chatResponse.text) {
          stream.markdown(fragment);
        }
        // Also provide links for reference as a structured list
        let docList = "\n\n**Relevant documentation:**\n";
        docList += result.data
          .slice(0, 5)
          .map((item) => {
            const title = item.title.replace(/^\d+-/, "");
            const snippet = item.snippet
              ? `\n> ${item.snippet.substring(0, 200)}${item.snippet.length > 200 ? "..." : ""}`
              : "";
            return `- [${title}](${item.url})${snippet}`;
          })
          .join("\n");
        stream.markdown(docList);
        return;
      } catch (err) {
        // If LLM fails, fall back to links
      }
    }
    // If no model or explanation fails, just provide links as a structured list
    let docList = "Here are some relevant documentation pages that may help:\n";
    docList += result.data
      .slice(0, 5)
      .map((item) => {
        const title = item.title.replace(/^\d+-/, "");
        const snippet = item.snippet
          ? `\n> ${item.snippet.substring(0, 200)}${item.snippet.length > 200 ? "..." : ""}`
          : "";
        return `- [${title}](${item.url})${snippet}`;
      })
      .join("\n");
    stream.markdown(docList);
    return;
  }

  // 4. Fallback: No results or error
  if (typeof result === "string") {
    stream.markdown(result);
  } else {
    stream.markdown(
      "Sorry, I could not find relevant documentation for your question.",
    );
    if (result.data && result.data.length > 0) {
      let docList = "Here are a few pages that might be helpful:\n";
      docList += result.data
        .slice(0, 3)
        .map((item) => {
          const title = item.title.replace(/^\d+-/, "");
          const snippet = item.snippet
            ? `\n> ${item.snippet.substring(0, 200)}${item.snippet.length > 200 ? "..." : ""}`
            : "";
          return `- [${title}](${item.url})${snippet}`;
        })
        .join("\n");
      stream.markdown(docList);
    }
  }
};
