import type { PluginRoute } from "../types";
import { debug } from "../logger";

const pluginRoutes = new Map<string, PluginRoute[]>();

function isPluginRoute(val: unknown): val is PluginRoute {
  if (typeof val !== "object" || val === null) return false;
  const r = val as Record<string, unknown>;
  return (
    typeof r.method === "string" &&
    ["get", "post", "put", "delete", "patch"].includes(r.method as string) &&
    typeof r.path === "string" &&
    typeof r.handler === "function"
  );
}

function isPluginRouteArray(val: unknown): val is PluginRoute[] {
  return Array.isArray(val) && val.every(isPluginRoute);
}

function normalizePath(p: string): string {
  const s = p.trim().replace(/^\/+/, "").replace(/\/+$/, "") || "";
  return s ? `/${s}` : "/";
}

export async function initPluginRoutes(): Promise<void> {
  const { readdir, stat } = await import("fs/promises");
  const { join } = await import("path");
  const { pathToFileURL } = await import("url");
  const pluginDir =
    process.env.DEGOOG_PLUGINS_DIR ?? join(process.cwd(), "data", "plugins");
  pluginRoutes.clear();

  try {
    const entries = await readdir(pluginDir);
    for (const entry of entries) {
      const entryPath = join(pluginDir, entry);
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
        const routes = mod.routes ?? mod.default?.routes;
        if (!isPluginRouteArray(routes) || routes.length === 0) continue;
        const normalized = routes.map((r) => ({
          ...r,
          path: normalizePath(r.path),
        }));
        pluginRoutes.set(entry, normalized);
      } catch (err) {
        debug(
          "plugin-routes",
          `Failed to load routes from plugin: ${entry}`,
          err,
        );
      }
    }
  } catch (err) {
    debug("plugin-routes", "Failed to read plugin directory", err);
  }
}

export function getPluginRoutes(pluginId: string): PluginRoute[] {
  return [...(pluginRoutes.get(pluginId) ?? [])];
}

export function findPluginRoute(
  pluginId: string,
  method: string,
  path: string,
): PluginRoute | null {
  const routes = pluginRoutes.get(pluginId);
  if (!routes) return null;
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "") || "";
  const want = normalized ? `/${normalized}` : "/";
  return (
    routes.find((r) => r.method === method.toLowerCase() && r.path === want) ??
    null
  );
}

export async function reloadPluginRoutes(): Promise<void> {
  pluginRoutes.clear();
  await initPluginRoutes();
}
