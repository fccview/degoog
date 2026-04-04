import type { RequestMiddleware, Translate } from "../../types";
import { debug } from "../../utils/logger";
import { registerPluginNamespace } from "../../utils/plugin-assets";
import { createTranslatorFromPath } from "../../utils/translation";

const middlewares = new Map<string, RequestMiddleware>();

function isRequestMiddleware(val: unknown): val is RequestMiddleware {
  if (typeof val !== "object" || val === null) return false;
  const m = val as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.name === "string" &&
    typeof m.handle === "function"
  );
}

export async function initMiddlewareRegistry(): Promise<void> {
  const { readdir, stat } = await import("fs/promises");
  const { join } = await import("path");
  const { pathToFileURL } = await import("url");
  const { pluginsDir } = await import("../../utils/paths");
  const pluginDir = pluginsDir();
  middlewares.clear();

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
        const m = mod.middleware ?? mod.default?.middleware;

        if (!m || !isRequestMiddleware(m)) continue;

        m.t = await createTranslatorFromPath(entryPath);
        registerPluginNamespace(entry, `middleware/${m.id}`);

        middlewares.set(m.id, m);
      } catch (err) {
        debug(
          "middleware",
          `Failed to load middleware from plugin: ${entry}`,
          err,
        );
      }
    }
  } catch (err) {
    debug("middleware", "Failed to read plugin directory", err);
  }
}

export function getMiddleware(id: string): RequestMiddleware | null {
  return middlewares.get(id) ?? null;
}

export async function reloadMiddlewareRegistry(): Promise<void> {
  middlewares.clear();
  await initMiddlewareRegistry();
}

export function getAllMiddlewareTranslators(): {
  namespace: string;
  translator: Translate;
}[] {
  return Array.from(middlewares.values())
    .filter((m) => !!m.t)
    .map((m) => ({ namespace: `middleware/${m.id}`, translator: m.t! }));
}
