import * as cheerio from "cheerio";
import type { SearchEngine, SearchResult, TimeFilter } from "../types";
import { getRandomUserAgent } from "../user-agents";

export class DuckDuckGoEngine implements SearchEngine {
  name = "DuckDuckGo";
  bangShortcut = "ddg";

  async executeSearch(
    query: string,
    page?: number,
    timeFilter?: TimeFilter,
  ): Promise<SearchResult[]> {
    const offset = ((page || 1) - 1) * 30;
    const params = new URLSearchParams({ q: query });
    if (offset > 0) {
      params.set("q", String(offset));
      params.set("dc", String(offset + 1));
    }
    if (timeFilter && timeFilter !== "any") {
      const dfMap: Record<string, string> = {
        hour: "h",
        day: "d",
        week: "w",
        month: "m",
        year: "y",
      };
      if (dfMap[timeFilter]) params.set("df", dfMap[timeFilter]);
    }
    const url = `https://html.duckduckgo.com/html/?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": getRandomUserAgent() },
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      const titleEl = $(el).find(".result__title a").first();
      const snippetEl = $(el).find(".result__snippet").first();

      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || "";
      const snippet = snippetEl.text().trim();

      if (href.includes("uddg=")) {
        try {
          const parsed = new URL(href, "https://duckduckgo.com");
          href = decodeURIComponent(parsed.searchParams.get("uddg") || href);
        } catch {
          /* keep original */
        }
      }

      if (title && href && href.startsWith("http")) {
        results.push({ title, url: href, snippet, source: this.name });
      }
    });

    return results;
  }
}
