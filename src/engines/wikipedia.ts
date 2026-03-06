import type { SearchEngine, SearchResult, TimeFilter } from "../types";

export class WikipediaEngine implements SearchEngine {
  name = "Wikipedia";
  bangShortcut = "w";

  async executeSearch(query: string, page?: number, _timeFilter?: TimeFilter): Promise<SearchResult[]> {
    const offset = ((page || 1) - 1) * 15;
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=15&sroffset=${offset}&utf8=1`;
    const response = await fetch(url, {
      headers: { "Api-User-Agent": "degoog/1.0" },
    });
    const data = (await response.json()) as {
      query: {
        search: Array<{ title: string; snippet: string; pageid: number }>;
      };
    };
    const results: SearchResult[] = [];

    for (const item of data.query.search) {
      const snippet = item.snippet.replace(/<[^>]+>/g, "").trim();
      results.push({
        title: item.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
        snippet,
        source: this.name,
      });
    }

    return results;
  }
}
