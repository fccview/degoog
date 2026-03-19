import { join } from "path";
import type { SearchResultTab } from "../../types";
import {
  isDisabled,
} from "../../utils/plugin-settings";
import {
  loadPluginAssets,
  initPlugin,
  registerPluginSettingsId,
} from "../../utils/plugin-assets";
import { debug } from "../../utils/logger";

let tabPlugins: SearchResultTab[] = [];

function isSearchResultTab(val: unknown): val is SearchResultTab {
  if (typeof val !== "object" || val === null) return false;
  const t = val as SearchResultTab;
  if (typeof t.id !== "string" || typeof t.name !== "string") return false;
  const hasExecute = typeof t.executeSearch === "function";
  const hasEngineType =
    typeof t.engineType === "string" && t.engineType.trim() !== "";
  return hasExecute || hasEngineType;
}

async function loadTabsFromRoot(
  rootDir: string,
  source: "plugin" | "builtin",
): Promise<void> {
  const { readdir, stat } = await import("fs/promises");
  const { pathToFileURL } = await import("url");
  let entries: string[];
  try {
    entries = await readdir(rootDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const entryPath = join(rootDir, entry);
    const entryStat = await stat(entryPath).catch(() => null);
    if (!entryStat?.isDirectory()) continue;

    let indexFile: string | undefined;
    for (const f of ["index.js", "index.ts", "index.mjs", "index.cjs"]) {
      const s = await stat(join(entryPath, f)).catch(() => null);
      if (s?.isFile()) {
        indexFile = f;
        break;
      }
    }
    if (!indexFile) continue;

    try {
      const fullPath = join(entryPath, indexFile);
      const url = pathToFileURL(fullPath).href;
      const mod = await import(url);
      const tab = mod.tab ?? mod.searchResultTab ?? mod.default?.tab;
      if (!tab || !isSearchResultTab(tab)) continue;

      const tabSettingsId = tab.settingsId ?? `tab-${tab.id}`;
      registerPluginSettingsId(entry, tabSettingsId);

      if (!(await isDisabled(tabSettingsId))) {
        const template = await loadPluginAssets(entryPath, entry, tabSettingsId, source);
        await initPlugin(tab, entryPath, tabSettingsId, template);
      }
      tabPlugins.push(tab);
    } catch (err) {
      debug("search-result-tabs", `Failed to load tab plugin: ${entry}`, err);
    }
  }
}

export async function initSearchResultTabs(): Promise<void> {
  const { pluginsDir } = await import("../../utils/paths");
  const pluginDir = pluginsDir();
  tabPlugins = [];
  await loadTabsFromRoot(pluginDir, "plugin");
}

export function getSearchResultTabs(): SearchResultTab[] {
  return [...tabPlugins];
}

export function getSearchResultTabById(tabId: string): SearchResultTab | null {
  return tabPlugins.find((t) => t.id === tabId) ?? null;
}

export async function reloadSearchResultTabs(): Promise<void> {
  tabPlugins = [];
  await initSearchResultTabs();
}
