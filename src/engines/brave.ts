import type { SearchEngine, SearchResult, TimeFilter } from "../types";

const BRAVE_API_KEY = process.env.DEGOOG_BRAVE_API_KEY ?? "";

interface BraveApiResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveApiResponse {
  web?: { results?: BraveApiResult[] };
}

export class BraveEngine implements SearchEngine {
  name = "Brave Search";
  bangShortcut = "brave";

  async executeSearch(
    query: string,
    page: number = 1,
    timeFilter?: TimeFilter,
  ): Promise<SearchResult[]> {
    if (!BRAVE_API_KEY) return [];
    const count = 20;
    const offset = Math.min(page - 1, 9);
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      offset: String(offset),
    });
    if (timeFilter && timeFilter !== "any") {
      const freshMap: Record<string, string> = {
        hour: "pd",
        day: "pd",
        week: "pw",
        month: "pm",
        year: "py",
      };
      if (freshMap[timeFilter]) params.set("freshness", freshMap[timeFilter]);
    }
    const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "X-Subscription-Token": BRAVE_API_KEY,
        Accept: "application/json",
      },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as BraveApiResponse;
    const raw = data.web?.results ?? [];
    return raw
      .filter((r) => r.url && r.title)
      .map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.description ?? "",
        source: this.name,
      }));
  }
}
