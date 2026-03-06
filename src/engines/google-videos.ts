import * as cheerio from "cheerio";
import type { SearchEngine, SearchResult, TimeFilter } from "../types";

const GSA_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/399.2.845414227 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
];

export class GoogleVideosEngine implements SearchEngine {
  name = "Google Videos";

  async executeSearch(
    query: string,
    page: number = 1,
    timeFilter?: TimeFilter,
  ): Promise<SearchResult[]> {
    const start = (page - 1) * 20;

    const params = new URLSearchParams({
      q: query,
      udm: "7",
      hl: "en",
      ie: "utf8",
      oe: "utf8",
      start: String(start),
      filter: "0",
    });

    if (timeFilter && timeFilter !== "any") {
      const tbsMap: Record<string, string> = {
        hour: "qdr:h",
        day: "qdr:d",
        week: "qdr:w",
        month: "qdr:m",
        year: "qdr:y",
      };
      if (tbsMap[timeFilter]) params.set("tbs", tbsMap[timeFilter]);
    }

    const ua =
      GSA_USER_AGENTS[Math.floor(Math.random() * GSA_USER_AGENTS.length)];
    const response = await fetch(
      `https://www.google.com/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+",
        },
        redirect: "follow",
      },
    );

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    $(".vG22wb").each((_, el) => {
      const titleEl = $(el).find(".ObbMBf a").first();
      const durationEl = $(el).find(".ieBN4d").first();

      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || "";

      if (href.startsWith("/url?")) {
        try {
          const parsed = new URL(href, "https://www.google.com");
          href = decodeURIComponent(parsed.searchParams.get("q") || parsed.searchParams.get("url") || href);
        } catch {}
      }

      if (!title || !href || !href.startsWith("http") || seen.has(href)) return;
      seen.add(href);

      let thumbnail = "";
      const vidMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      if (vidMatch) {
        thumbnail = `https://i.ytimg.com/vi/${vidMatch[1]}/mqdefault.jpg`;
      }

      results.push({
        title,
        url: href,
        snippet: "",
        source: this.name,
        thumbnail,
        duration: durationEl.text().trim(),
      });
    });

    if (results.length === 0) {
      $(".MjjYud").each((_, el) => {
        const titleEl = $(el).find("h3").first();
        const linkEl = $(el).find("a[href]").first();
        const descEl = $(el).find(".ITZIwc, [data-sncf]").first();
        const durationEl = $(el).find(".k1U36b").first();

        const title = titleEl.text().trim();
        let href = linkEl.attr("href") || "";

        if (href.startsWith("/url?")) {
          try {
            const parsed = new URL(href, "https://www.google.com");
            href = parsed.searchParams.get("q") || parsed.searchParams.get("url") || href;
          } catch {}
        }

        if (!title || !href || !href.startsWith("http") || href.includes("google.com/search")) return;

        let thumbnail = "";
        const vidMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (vidMatch) {
          thumbnail = `https://i.ytimg.com/vi/${vidMatch[1]}/mqdefault.jpg`;
        }

        results.push({
          title,
          url: href,
          snippet: descEl.text().trim(),
          source: this.name,
          thumbnail,
          duration: durationEl.text().trim(),
        });
      });
    }

    return results;
  }
}
