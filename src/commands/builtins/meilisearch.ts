import type { BangCommand, CommandContext, CommandResult } from "../../types";

const MEILI_URL = process.env.DEGOOG_MEILI_URL || "";
const MEILI_API_KEY = process.env.DEGOOG_MEILI_API_KEY || "";
const MEILI_INDEXES = (process.env.DEGOOG_MEILI_INDEXES || "").split(",").map((s) => s.trim()).filter(Boolean);

const TITLE_FIELD = process.env.DEGOOG_MEILI_TITLE_FIELD || "title";
const URL_FIELD = process.env.DEGOOG_MEILI_URL_FIELD || "url";
const CONTENT_FIELD = process.env.DEGOOG_MEILI_CONTENT_FIELD || "content";
const THUMBNAIL_FIELD = process.env.DEGOOG_MEILI_THUMBNAIL_FIELD || "thumbnail";
const SOURCE_FIELD = process.env.DEGOOG_MEILI_SOURCE_FIELD || "source";
const TYPE_FIELD = process.env.DEGOOG_MEILI_TYPE_FIELD || "type";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PER_PAGE = 20;

async function searchIndex(index: string, query: string, offset: number = 0): Promise<{ index: string; hits: Record<string, any>[]; estimatedTotalHits: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEILI_API_KEY) headers["Authorization"] = `Bearer ${MEILI_API_KEY}`;

  const res = await fetch(`${MEILI_URL}/indexes/${index}/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ q: query, limit: PER_PAGE, offset }),
  });

  const data = await res.json() as { hits?: Record<string, any>[]; estimatedTotalHits?: number };
  return { index, hits: data.hits || [], estimatedTotalHits: data.estimatedTotalHits ?? (data.hits?.length || 0) };
}

export const meilisearchCommand: BangCommand = {
  name: "Meilisearch",
  description: "Search across your Meilisearch indexes",
  trigger: "meili",
  aliases: ["ms"],
  async execute(args: string, context?: CommandContext): Promise<CommandResult> {
    if (!args.trim()) {
      return {
        title: "Meilisearch",
        html: `<div class="command-result"><p>Usage: <code>!meili &lt;search term&gt;</code></p><p>Indexes: ${MEILI_INDEXES.map(i => `<code>${escHtml(i)}</code>`).join(", ") || "none configured"}</p></div>`,
      };
    }

    try {
      const term = args.trim();
      const page = context?.page ?? 1;
      const offset = (page - 1) * PER_PAGE;

      const settled = await Promise.allSettled(MEILI_INDEXES.map((idx) => searchIndex(idx, term, offset)));

      const allHits: { hit: Record<string, any>; index: string }[] = [];
      let totalEstimated = 0;
      for (const result of settled) {
        if (result.status === "fulfilled") {
          totalEstimated += result.value.estimatedTotalHits;
          for (const hit of result.value.hits) {
            allHits.push({ hit, index: result.value.index });
          }
        }
      }

      if (allHits.length === 0) {
        return {
          title: "Meilisearch",
          html: `<div class="command-result"><p>No results found for "${escHtml(term)}"</p></div>`,
        };
      }

      const results = allHits
        .map(({ hit, index }) => {
          const title = String(hit[TITLE_FIELD] || "");
          const url = String(hit[URL_FIELD] || "");
          const content = String(hit[CONTENT_FIELD] || hit["metadata_summary"] || "");
          const thumbnail = String(hit[THUMBNAIL_FIELD] || "");
          const source = String(hit[SOURCE_FIELD] || "");
          const type = String(hit[TYPE_FIELD] || "");

          if (!title || !url) return "";

          const thumbImg = thumbnail
            ? `<img class="result-favicon" src="${escHtml(thumbnail)}" alt="" style="max-height:52px" onerror="this.style.display='none'">`
            : `<img class="result-favicon" src="" alt="">`;

          const indexLabel = index.replace(/_content$/, "");
          const tags = [
            `<span class="result-engine-tag">${escHtml(indexLabel)}</span>`,
            type ? `<span class="result-engine-tag">${escHtml(type)}</span>` : "",
            source ? `<span class="result-engine-tag">${escHtml(source)}</span>` : "",
          ].filter(Boolean).join("");

          return `<div class="result-item"><div class="result-url-row">${thumbImg}<cite class="result-cite">${escHtml(url)}</cite></div><a class="result-title" href="${escHtml(url)}" target="_blank">${escHtml(title)}</a><p class="result-snippet">${escHtml(content)}</p><div class="result-engines">${tags}</div></div>`;
        })
        .filter(Boolean)
        .join("");

      const totalPages = Math.ceil(totalEstimated / PER_PAGE);
      const pageInfo = totalPages > 1 ? ` — Page ${page} of ${totalPages}` : "";
      return {
        title: `Meilisearch: ${term} — ${totalEstimated} results${pageInfo}`,
        html: `<div class="command-result">${results}</div>`,
        totalPages,
      };
    } catch {
      return {
        title: "Meilisearch",
        html: `<div class="command-result"><p>Failed to connect to Meilisearch. Check your configuration.</p></div>`,
      };
    }
  },
};
