const DEFAULT_BASE_URL =
  "http://localhost:8888/.netlify/functions/search" as const;
const baseUrl = process.env.DAGGER_CODE_SEARCH_BASE_URL ?? DEFAULT_BASE_URL;
const REQUEST_TIMEOUT = 10000; // 10 seconds timeout

export interface SearchResultItem {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

export interface SearchResponse {
  readonly query: string;
  readonly count: number;
  readonly data: readonly SearchResultItem[];
}

export type SearchDocsFn = (query: string) => Promise<SearchResponse | string>;

export const searchDocs: SearchDocsFn = async (
  query: string
): Promise<SearchResponse | string> => {
  try {
    const searchUrl = `${baseUrl}?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as SearchResponse;
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format - not a valid JSON object");
      }
      if (
        typeof data.query !== "string" ||
        typeof data.count !== "number" ||
        !Array.isArray(data.data)
      ) {
        throw new Error(
          "Invalid response structure - missing required fields (query, count, data)"
        );
      }

      const validatedData: SearchResultItem[] = data.data.filter(
        (item): item is SearchResultItem => {
          return (
            item &&
            typeof item.title === "string" &&
            typeof item.url === "string" &&
            typeof item.snippet === "string"
          );
        }
      );

      const validatedResponse: SearchResponse = {
        query: data.query,
        count: data.count,
        data: validatedData,
      };
      return validatedResponse;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error(
          "Request timeout - the search service is taking too long to respond"
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error searching docs:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return `Failed to search for "${query}": ${errorMessage}`;
  }
};
