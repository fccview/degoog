import { Hono } from "hono";
import * as cache from "../cache";
import { search, searchSingleEngine, mergeNewResults } from "../search";
import { getEngineRegistry } from "../engines/registry";
import { getSlotPlugins } from "../slots/registry";
import { getSettings } from "../plugin-settings";
import type {
  EngineConfig,
  SearchType,
  TimeFilter,
  SearchResponse,
  SlotPanelResult,
} from "../types";

const router = new Hono();

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

async function runSlotPlugins(
  query: string,
  clientIp?: string,
): Promise<SlotPanelResult[]> {
  const plugins = getSlotPlugins();
  const panels: SlotPanelResult[] = [];
  for (const plugin of plugins) {
    try {
      const slotSettings = await getSettings(`slot-${plugin.id}`);
      if (slotSettings["disabled"] === "true") continue;
      const ok = await Promise.resolve(plugin.trigger(query.trim()));
      if (!ok) continue;
      const out = await plugin.execute(query, { clientIp });
      if (!out.html || !out.html.trim()) continue;
      panels.push({
        id: plugin.id,
        title: out.title,
        html: out.html,
        position: plugin.position,
      });
    } catch {}
  }
  return panels;
}

router.get("/api/search", async (c) => {
  const searchType = (c.req.query("type") || "all") as SearchType;
  let query = c.req.query("q") ?? "";
  if (typeof query !== "string") query = "";
  if (!query.trim() && searchType !== "news")
    return c.json({ error: "Missing query parameter 'q'" }, 400);

  const engines = parseEngineConfig(new URL(c.req.url).searchParams);
  const page = Math.max(
    1,
    Math.min(10, Math.floor(Number(c.req.query("page"))) || 1),
  );
  const timeFilter = (c.req.query("time") || "any") as TimeFilter;
  const key = cacheKey(query, engines, searchType, page, timeFilter);

  const cached = cache.get(key);
  let response: SearchResponse;
  if (cached) {
    response = cached;
  } else {
    response = await search(query, engines, searchType, page, timeFilter);
    cache.set(
      key,
      response,
      cache.hasFailedEngines(response) ? cache.SHORT_TTL_MS : undefined,
    );
  }

  if (searchType === "all") {
    response = { ...response, slotPanels: [] };
  }

  return c.json(response);
});

router.get("/api/slots", async (c) => {
  const query = c.req.query("q");
  if (!query || !query.trim()) return c.json({ panels: [] });
  const clientIp =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip");
  const panels = await runSlotPlugins(query.trim(), clientIp);
  return c.json({ panels });
});

router.get("/api/search/retry", async (c) => {
  const query = c.req.query("q");
  const engineName = c.req.query("engine");
  if (!query || !engineName)
    return c.json({ error: "Missing 'q' or 'engine' parameter" }, 400);

  const engines = parseEngineConfig(new URL(c.req.url).searchParams);
  const searchType = (c.req.query("type") || "all") as SearchType;
  const page = Math.max(
    1,
    Math.min(10, Math.floor(Number(c.req.query("page"))) || 1),
  );
  const timeFilter = (c.req.query("time") || "any") as TimeFilter;

  const { results: newResults, timing } = await searchSingleEngine(
    engineName,
    query,
    page,
    timeFilter,
  );
  const key = cacheKey(query, engines, searchType, page, timeFilter);
  const cached = cache.get(key);

  if (cached) {
    const updatedTimings = cached.engineTimings.map((et) =>
      et.name === engineName ? timing : et,
    );
    const merged =
      newResults.length > 0
        ? mergeNewResults(cached.results, newResults)
        : cached.results;
    const updated = {
      ...cached,
      results: merged,
      engineTimings: updatedTimings,
      atAGlance:
        merged.length > 0 && merged[0].snippet ? merged[0] : cached.atAGlance,
    };
    cache.set(
      key,
      updated,
      cache.hasFailedEngines(updated) ? cache.SHORT_TTL_MS : undefined,
    );
    return c.json(updated);
  }

  return c.json({
    results: newResults.map((r, i) => ({
      ...r,
      score: Math.max(10 - i, 1),
      sources: [r.source],
    })),
    timing,
    engineTimings: [timing],
  });
});

router.get("/api/lucky", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "Missing query parameter 'q'" }, 400);

  const engines = parseEngineConfig(new URL(c.req.url).searchParams);
  const key = cacheKey(query, engines, "all", 1);
  let response = cache.get(key);
  if (!response) {
    response = await search(query, engines, "all", 1);
    cache.set(key, response);
  }
  if (response.results.length > 0) return c.redirect(response.results[0].url);
  return c.json({ error: "No results found" }, 404);
});

export default router;
