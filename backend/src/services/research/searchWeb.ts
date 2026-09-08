import { tavily } from "@tavily/core";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

const getTavilyClient = () => {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  return tavily({
    apiKey,
  });
};

export const searchWeb = async (query: string): Promise<WebSearchResult[]> => {
  try {
    const client = getTavilyClient();

    const response = await client.search(query, {
      searchDepth: "basic",
      maxResults: 5,
    });

    return response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
    }));
  } catch (error) {
    console.error(`Web search failed for query: ${query}`, error);

    throw new Error("Failed to search the web");
  }
};
