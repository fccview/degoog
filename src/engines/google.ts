import * as cheerio from "cheerio";
import type { SearchEngine, SearchResult, TimeFilter } from "../types";

const GSA_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/399.2.845414227 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/399.2.845414227 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/406.0.862495628 Mobile/15E148 Safari/604.1",
];

export class GoogleEngine implements SearchEngine {
  name = "Google";
  bangShortcut = "g";

  async executeSearch(
    query: string,
    page: number = 1,
    timeFilter?: TimeFilter,
  ): Promise<SearchResult[]> {
    const start = (page - 1) * 10;

    const params = new URLSearchParams({
      q: query,
      hl: "en",
      lr: "lang_en",
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

    const url = `https://www.google.com/search?${params.toString()}`;
    const ua =
      GSA_USER_AGENTS[Math.floor(Math.random() * GSA_USER_AGENTS.length)];

    const response = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+",
      },
      redirect: "follow",
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".MjjYud").each((_, el) => {
      const titleEl = $(el).find("[role='link']").first();
      const linkEl = $(el).find("a[href]").first();
      const snippetEl = $(el).find("[data-sncf]").first();

      const title = titleEl.text().trim() || linkEl.text().trim();
      let href = linkEl.attr("href") || "";

      if (href.startsWith("/url?")) {
        try {
          const parsed = new URL(href, "https://www.google.com");
          href =
            parsed.searchParams.get("q") ||
            parsed.searchParams.get("url") ||
            href;
        } catch {}
      }

      const snippet = snippetEl.text().trim();

      if (
        title &&
        href &&
        href.startsWith("http") &&
        !href.includes("google.com/search")
      ) {
        results.push({ title, url: href, snippet, source: this.name });
      }
    });

    if (results.length === 0) {
      $(".g").each((_, el) => {
        const titleEl = $(el).find("h3").first();
        const linkEl = $(el).find("a[href]").first();
        const snippetEl = $(el).find(".VwiC3b, [data-sncf], .IsZvec").first();

        const title = titleEl.text().trim();
        let href = linkEl.attr("href") || "";

        if (href.startsWith("/url?")) {
          try {
            const parsed = new URL(href, "https://www.google.com");
            href =
              parsed.searchParams.get("q") ||
              parsed.searchParams.get("url") ||
              href;
          } catch {}
        }

        const snippet = snippetEl.text().trim();

        if (
          title &&
          href &&
          href.startsWith("http") &&
          !href.includes("google.com/search")
        ) {
          results.push({ title, url: href, snippet, source: this.name });
        }
      });
    }

    return results;
  }
}
