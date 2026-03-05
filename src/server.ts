import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import * as cache from "./cache";
import { search } from "./search";
import type { EngineConfig, SearchType, TimeFilter } from "./types";
import { getEngineRegistry, getDefaultEngineConfig, initPlugins } from "./engines/registry";
import { matchBangCommand, initCommandPlugins, getCommandRegistry } from "./commands/registry";

const app = new Hono();

function parseEngineConfig(query: URLSearchParams): EngineConfig {
  const registry = getEngineRegistry();
  const config: EngineConfig = {};
  for (const { id } of registry) {
    config[id] = query.get(id) !== "false";
  }
  return config;
}

function cacheKey(
  query: string,
  engines: EngineConfig,
  type: SearchType,
  page: number,
  timeFilter: TimeFilter = "any",
): string {
  const q = query.trim().toLowerCase();
  return `${q}|${JSON.stringify(engines)}|${type}|${page}|${timeFilter}`;
}

app.use("/public/*", serveStatic({ root: "src/" }));

app.get("/", (c) => {
  const q = c.req.query("q");
  if (q && q.trim()) {
    const params = new URLSearchParams(c.req.url.split("?")[1] || "");
    return c.redirect(`/search?${params.toString()}`, 302);
  }
  return c.html(Bun.file("src/public/index.html").text());
});

app.get("/search", (c) => {
  return c.html(Bun.file("src/public/search.html").text());
});

app.get("/settings", (c) => {
  return c.html(Bun.file("src/public/settings.html").text());
});

app.get("/api/engines", (c) => {
  const registry = getEngineRegistry();
  const defaults = getDefaultEngineConfig();
  return c.json({ engines: registry, defaults });
});

app.get("/settings.json", async (c) => {
  try {
    const file = Bun.file("settings.json");
    const data = await file.json();
    return c.json(data);
  } catch {
    return c.json({ engines: getDefaultEngineConfig() });
  }
});

app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  const engines = parseEngineConfig(new URL(c.req.url).searchParams);

  const searchType = (c.req.query("type") || "all") as SearchType;
  const pageRaw = c.req.query("page");
  const page = Math.max(1, Math.min(10, Math.floor(Number(pageRaw)) || 1));
  const timeFilter = (c.req.query("time") || "any") as TimeFilter;
  const key = cacheKey(query, engines, searchType, page, timeFilter);
  const cached = cache.get(key);
  if (cached) return c.json(cached);
  const response = await search(query, engines, searchType, page, timeFilter);
  cache.set(key, response);
  return c.json(response);
});

async function getSuggestions(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const encoded = encodeURIComponent(query);
  const [googleRes, ddgRes] = await Promise.allSettled([
    fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encoded}`,
    ).then((r) => r.json()),
    fetch(`https://duckduckgo.com/ac/?q=${encoded}&type=list`).then((r) =>
      r.json(),
    ),
  ]);
  const googleSuggestions: string[] =
    googleRes.status === "fulfilled" ? (googleRes.value as [unknown, string[]])[1] || [] : [];
  const ddgSuggestions: string[] =
    ddgRes.status === "fulfilled" ? (ddgRes.value as [unknown, string[]])[1] || [] : [];
  const seen = new Set<string>();
  const merged: string[] = [];
  const lower = query.toLowerCase();
  for (const s of [...googleSuggestions, ...ddgSuggestions]) {
    const key = String(s).toLowerCase();
    if (key !== lower && !seen.has(key)) {
      seen.add(key);
      merged.push(String(s));
    }
    if (merged.length >= 10) break;
  }
  return merged;
}

function buildOpenSearchXml(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>deGoog</ShortName>
  <Description>deGoog Search</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/public/favicon/favicon.ico</Image>
  <Url type="text/html" template="${origin}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" template="${origin}/api/suggest/opensearch?q={searchTerms}"/>
</OpenSearchDescription>`;
}

app.get("/opensearch.xml", (c) => {
  const proto = c.req.header("x-forwarded-proto") || new URL(c.req.url).protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || new URL(c.req.url).host;
  const origin = `${proto}://${host}`;
  return c.body(buildOpenSearchXml(origin), 200, {
    "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
  });
});

app.get("/api/suggest", async (c) => {
  const query = c.req.query("q") ?? "";
  const merged = await getSuggestions(query);
  return c.json(merged);
});

app.get("/api/suggest/opensearch", async (c) => {
  const query = c.req.query("q") ?? "";
  const suggestions = await getSuggestions(query);
  return c.json([query, suggestions], 200, {
    "Content-Type": "application/x-suggestions+json",
  });
});

app.get("/api/lucky", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  const engines = parseEngineConfig(new URL(c.req.url).searchParams);

  const key = cacheKey(query, engines, "all", 1);
  let response = cache.get(key);
  if (!response) {
    response = await search(query, engines, "all", 1);
    cache.set(key, response);
  }
  if (response.results.length > 0) {
    return c.redirect(response.results[0].url);
  }
  return c.json({ error: "No results found" }, 404);
});

app.get("/api/commands", (c) => {
  return c.json(getCommandRegistry());
});

app.get("/api/command", async (c) => {
  const q = c.req.query("q");
  if (!q) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }
  const match = matchBangCommand(q);
  if (!match) {
    return c.json({ error: "Unknown command" }, 404);
  }
  const forwarded = c.req.header("x-forwarded-for");
  const realIp = c.req.header("x-real-ip");
  const bunIp = c.env?.requestIP?.(c.req.raw)?.address;
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : realIp || bunIp || undefined;
  const result = await match.command.execute(match.args, { clientIp });
  return c.json({
    type: "command",
    trigger: match.command.trigger,
    title: result.title,
    html: result.html,
  });
});

app.post("/api/cache/clear", (c) => {
  cache.clear();
  return c.json({ ok: true });
});

const port = Number(process.env.PORT) || 4444;

Promise.all([initPlugins(), initCommandPlugins()]).then(() => {
  Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`degoog running on http://localhost:${port}`);
});
