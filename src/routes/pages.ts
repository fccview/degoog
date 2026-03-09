import { Hono } from "hono";
import * as cache from "../cache";
import { getEngineRegistry, getDefaultEngineConfig } from "../engines/registry";
import { getThemeHtml, getActiveTheme, getActiveThemeDataAttrs } from "../themes/registry";
import { getAllPluginCss, getPluginScriptFolders } from "../plugin-assets";
import { shouldServeSettingsGate } from "./settings-auth";
import pkg from "../../package.json";

const router = new Hono();

function buildOpenSearchXml(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>degoog</ShortName>
  <Description>Search</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/public/favicon/favicon.ico</Image>
  <Url type="text/html" template="${origin}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" template="${origin}/api/suggest/opensearch?q={searchTerms}"/>
</OpenSearchDescription>`;
}

function themeCssPlaceholder(): string {
  const theme = getActiveTheme();
  if (!theme?.manifest.css) return "";
  return `<link rel="stylesheet" href="/theme/style.css?v=${pkg.version}">`;
}

function pluginAssetsPlaceholder(): string {
  const v = pkg.version;
  const parts: string[] = [];
  if (getAllPluginCss()) parts.push(`<link rel="stylesheet" href="/api/plugins/styles.css?v=${v}">`);
  for (const folder of getPluginScriptFolders()) {
    parts.push(`<script type="module" src="/plugins/${folder}/script.js?v=${v}"><\/script>`);
  }
  return parts.join("\n  ");
}

async function buildPage(filename: string): Promise<string> {
  const html = await Bun.file(`src/public/${filename}`).text();
  const themeAttrs = await getActiveThemeDataAttrs();
  return html
    .replaceAll("__APP_VERSION__", pkg.version)
    .replace("__THEME_CSS__", themeCssPlaceholder())
    .replace("__THEME_ATTRS__", themeAttrs)
    .replace("__PLUGIN_ASSETS__", pluginAssetsPlaceholder());
}

router.get("/", async (c) => {
  const q = c.req.query("q");
  if (q?.trim()) {
    const params = new URLSearchParams(c.req.url.split("?")[1] || "");
    return c.redirect(`/search?${params.toString()}`, 302);
  }
  const override = await getThemeHtml("index");
  if (override) {
    return c.html(override.replaceAll("__APP_VERSION__", pkg.version));
  }
  return c.html(await buildPage("index.html"));
});

router.get("/search", async (c) => {
  const override = await getThemeHtml("search");
  if (override) return c.html(override.replaceAll("__APP_VERSION__", pkg.version));
  return c.html(await buildPage("search.html"));
});

router.get("/settings", async (c) => {
  if (await shouldServeSettingsGate(c)) {
    return c.html(await buildPage("settings-gate.html"));
  }
  return c.html(await buildPage("settings.html"));
});

router.get("/api/engines", (c) => {
  return c.json({
    engines: getEngineRegistry(),
    defaults: getDefaultEngineConfig(),
  });
});

router.get("/opensearch.xml", (c) => {
  const proto =
    c.req.header("x-forwarded-proto") ||
    new URL(c.req.url).protocol.replace(":", "");
  const host =
    c.req.header("x-forwarded-host") ||
    c.req.header("host") ||
    new URL(c.req.url).host;
  return c.body(buildOpenSearchXml(`${proto}://${host}`), 200, {
    "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
  });
});

router.post("/api/cache/clear", (c) => {
  cache.clear();
  return c.json({ ok: true });
});

export default router;
