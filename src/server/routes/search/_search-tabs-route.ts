import type { Hono } from "hono";
import { getCustomEngineTypes } from "../../extensions/engines/registry";
import {
  getSearchResultTabs,
} from "../../extensions/search-result-tabs/registry";
import { isDisabled } from "../../utils/plugin-settings";

export function registerSearchTabsRoutes(router: Hono): void {
  router.get("/api/search-tabs", async (c) => {
    const seen = new Set<string>();
    const list: { id: string; name: string; icon: string | null }[] = [];

    for (const engineType of getCustomEngineTypes()) {
      seen.add(engineType);
      list.push({
        id: `engine:${engineType}`,
        name: engineType.charAt(0).toUpperCase() + engineType.slice(1),
        icon: null,
      });
    }

    const tabs = getSearchResultTabs();
    for (const tab of tabs) {
      if (tab.engineType && seen.has(tab.engineType)) {
        const existing = list.find((t) => t.id === `engine:${tab.engineType}`);
        if (existing) {
          existing.name = tab.name;
          existing.icon = tab.icon ?? null;
          existing.id = tab.id;
        }
        continue;
      }
      const settingsId = tab.settingsId ?? `tab-${tab.id}`;
      if (await isDisabled(settingsId)) continue;
      list.push({ id: tab.id, name: tab.name, icon: tab.icon ?? null });
    }
    return c.json({ tabs: list });
  });
}
