import { Context, Hono, Next } from "hono";
import { existsSync } from "fs";
import { validateSettingsToken } from "./settings-auth";
import { resolve, relative } from "path";

import {
  getRepos,
  getReposStatus,
  addRepo,
  removeRepo,
  refreshRepo,
  refreshAllRepos,
  listRepoItems,
  installItem,
  uninstallItem,
  getInstalledItems,
  getStoreDirPath,
  resolveScreenshotPath,
} from "../store/repo-manager";

const router = new Hono();

function getStoreToken(c: Context): string | undefined {
  return c.req.header("x-settings-token") ?? c.req.query("token");
}

const VALID_TYPES = ["plugin", "theme", "engine"] as const;
type ItemType = (typeof VALID_TYPES)[number];

function isValidType(type: string): type is ItemType {
  return (VALID_TYPES as readonly string[]).includes(type);
}

router.use("*", async (c: Context, next: Next) => {
  if (!(await validateSettingsToken(getStoreToken(c)))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

router.get("/api/store/repos", async (c) => {
  const repos = await getRepos();
  return c.json({ repos });
});

router.get("/api/store/repos/status", async (c) => {
  const statuses = await getReposStatus();
  return c.json({ statuses });
});

router.post("/api/store/repos", async (c) => {
  const body = await c.req.json<{ url?: string }>();
  const url = body?.url?.trim();
  if (!url) return c.json({ error: "Missing url" }, 400);
  try {
    const repo = await addRepo(url);
    return c.json(repo);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add repository";
    return c.json({ error: message }, 400);
  }
});

router.delete("/api/store/repos", async (c) => {
  const body = (await c.req.json<{ url?: string }>().catch(() => ({}))) as {
    url?: string;
  };
  const url = body.url?.trim();
  if (!url) return c.json({ error: "Missing url" }, 400);
  try {
    await removeRepo(url);
    return c.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to remove repository";
    return c.json({ error: message }, 400);
  }
});

router.post("/api/store/repos/refresh", async (c) => {
  const body = (await c.req.json<{ url?: string }>().catch(() => ({}))) as {
    url?: string;
  };
  const url = body.url?.trim();
  try {
    if (url) {
      await refreshRepo(url);
      return c.json({ ok: true });
    }
    const results = await refreshAllRepos();
    return c.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refresh failed";
    return c.json({ error: message }, 400);
  }
});

router.get("/api/store/items", async (c) => {
  const items = await listRepoItems();
  return c.json({ items });
});

router.get("/api/store/items/:repoSlug", async (c) => {
  const repoSlug = c.req.param("repoSlug");
  const repos = await getRepos();
  const repo = repos.find((r) => r.localPath === repoSlug);
  if (!repo) return c.json({ error: "Repository not found" }, 404);
  const items = await listRepoItems(repo.url);
  return c.json({ items });
});

router.post("/api/store/install", async (c) => {
  const body = await c.req.json<{
    repoUrl?: string;
    itemPath?: string;
    type?: string;
  }>();
  const { repoUrl, itemPath, type } = body ?? {};
  if (!repoUrl?.trim() || !itemPath?.trim() || !type) {
    return c.json({ error: "Missing repoUrl, itemPath, or type" }, 400);
  }
  if (!isValidType(type)) {
    return c.json({ error: "Invalid type" }, 400);
  }
  try {
    await installItem(repoUrl.trim(), itemPath.trim(), type);
    return c.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Install failed";
    return c.json({ error: message }, 400);
  }
});

router.post("/api/store/uninstall", async (c) => {
  const body = await c.req.json<{
    repoUrl?: string;
    itemPath?: string;
    type?: string;
  }>();
  const { repoUrl, itemPath, type } = body ?? {};
  if (!repoUrl?.trim() || !itemPath?.trim() || !type) {
    return c.json({ error: "Missing repoUrl, itemPath, or type" }, 400);
  }
  if (!isValidType(type)) {
    return c.json({ error: "Invalid type" }, 400);
  }
  try {
    await uninstallItem(repoUrl.trim(), itemPath.trim(), type);
    return c.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Uninstall failed";
    return c.json({ error: message }, 400);
  }
});

router.get("/api/store/installed", async (c) => {
  const installed = await getInstalledItems();
  return c.json({ installed });
});

router.get(
  "/api/store/screenshots/:repoSlug/:type/:item/:filename",
  async (c) => {
    const repoSlug = c.req.param("repoSlug");
    const type = c.req.param("type");
    const item = c.req.param("item");
    const filename = c.req.param("filename");
    const itemPath =
      type === "plugin"
        ? `plugins/${item}`
        : type === "theme"
          ? `themes/${item}`
          : `engines/${item}`;
    const resolved = resolveScreenshotPath(repoSlug, itemPath, filename);
    if (!resolved || !existsSync(resolved)) {
      return c.json({ error: "Not found" }, 404);
    }
    const storeDir = getStoreDirPath();
    const base = resolve(storeDir, repoSlug);
    const rel = relative(base, resolved);
    if (rel.startsWith("..") || rel.includes("..")) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const file = Bun.file(resolved);
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return c.body(await file.arrayBuffer(), 200, {
      "Content-Type": contentType,
    });
  },
);

export default router;
