import { readFile, writeFile, mkdir, readdir, stat, rm } from "fs/promises";
import { join, resolve, dirname, relative } from "path";
import { createHash } from "crypto";
import { removeSettings } from "../plugin-settings";
import { reloadCommands } from "../commands/registry";
import { reloadSlotPlugins } from "../slots/registry";
import { reloadSearchBarActions } from "../search-bar/registry";
import { reloadPluginRoutes } from "../plugin-routes/registry";
import { reloadMiddlewareRegistry } from "../middleware/registry";
import { reloadThemes } from "../themes/registry";
import { reloadEngines } from "../engines/registry";
import type {
  RepoInfo,
  ReposData,
  StoreItem,
  InstalledItem,
  RepoPackageJson,
  AuthorJson,
} from "./types";

const CLONE_TIMEOUT_MS = 60_000;
const OFFICIAL_REPO_URL =
  "https://github.com/fccview/fccview-degoog-extensions.git";

function getDataDir(): string {
  return process.env.DEGOOG_DATA_DIR ?? join(process.cwd(), "data");
}

function getReposPath(): string {
  return join(getDataDir(), "repos.json");
}

function getStoreDir(): string {
  return join(getDataDir(), "store");
}

function normalizeRepoUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.endsWith(".git")) return trimmed;
  return (
    trimmed + (trimmed.includes("?") || trimmed.includes("#") ? "" : ".git")
  );
}

function slugFromUrl(url: string): string {
  const normalized = normalizeRepoUrl(url);
  const hash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 8);
  let repoName = "repo";
  try {
    const u = new URL(normalized.replace(/\.git$/, ""));
    const segments = u.pathname.split("/").filter(Boolean);
    repoName = (segments.pop() ?? "repo").replace(/\.git$/, "") || "repo";
  } catch {
    repoName = "repo";
  }
  const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 32);
  return `${hash}-${safeName}`;
}

function isValidGitUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed.replace(/\.git$/, ""));
    return (
      u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ssh:"
    );
  } catch {
    return false;
  }
}

async function ensureReposStructure(): Promise<void> {
  const storeDir = getStoreDir();
  await mkdir(storeDir, { recursive: true });
  const reposPath = getReposPath();
  try {
    await readFile(reposPath, "utf-8");
  } catch {
    const initial: ReposData = { repos: [], installed: [] };
    await mkdir(dirname(reposPath), { recursive: true });
    await writeFile(reposPath, JSON.stringify(initial, null, 2), "utf-8");
  }
}

async function readReposData(): Promise<ReposData> {
  await ensureReposStructure();
  const raw = await readFile(getReposPath(), "utf-8");
  const parsed = JSON.parse(raw) as ReposData;
  if (!Array.isArray(parsed.repos)) parsed.repos = [];
  if (!Array.isArray(parsed.installed)) parsed.installed = [];
  return parsed;
}

async function writeReposData(data: ReposData): Promise<void> {
  await ensureReposStructure();
  await writeFile(getReposPath(), JSON.stringify(data, null, 2), "utf-8");
}

function getRepoByUrl(data: ReposData, url: string): RepoInfo | undefined {
  const normalized = normalizeRepoUrl(url);
  return data.repos.find((r) => normalizeRepoUrl(r.url) === normalized);
}

export async function addRepo(url: string): Promise<RepoInfo> {
  if (!isValidGitUrl(url)) {
    throw new Error(
      "Invalid git URL. Use http(s) or ssh URL ending in .git or without.",
    );
  }
  const normalized = normalizeRepoUrl(url);
  const data = await readReposData();
  if (data.repos.some((r) => normalizeRepoUrl(r.url) === normalized)) {
    throw new Error("This repository is already added.");
  }
  const slug = slugFromUrl(url);
  const storeDir = getStoreDir();
  const dest = join(storeDir, slug);
  const proc = Bun.spawn(["git", "clone", "--depth", "1", normalized, dest], {
    cwd: storeDir,
    stdout: "ignore",
    stderr: "pipe",
  });
  const exit = await Promise.race([
    proc.exited,
    new Promise<number>((_, rej) =>
      setTimeout(() => {
        proc.kill();
        rej(new Error("Clone timed out"));
      }, CLONE_TIMEOUT_MS),
    ),
  ]);
  if (exit !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err || `Git clone failed with code ${exit}`);
  }
  const pkgPath = join(dest, "package.json");
  let pkg: RepoPackageJson;
  try {
    const raw = await readFile(pkgPath, "utf-8");
    pkg = JSON.parse(raw) as RepoPackageJson;
  } catch {
    await rm(dest, { recursive: true, force: true });
    throw new Error("Repository has no valid package.json in the root.");
  }
  const now = new Date().toISOString();
  const repoInfo: RepoInfo = {
    url: normalized,
    localPath: slug,
    addedAt: now,
    lastFetched: now,
    name: pkg.name ?? slug,
    description: pkg.description ?? "",
    error: null,
  };
  data.repos.push(repoInfo);
  await writeReposData(data);
  return repoInfo;
}

export async function removeRepo(url: string): Promise<void> {
  const data = await readReposData();
  const repo = getRepoByUrl(data, url);
  if (!repo) throw new Error("Repository not found.");
  if (normalizeRepoUrl(repo.url) === normalizeRepoUrl(OFFICIAL_REPO_URL)) {
    throw new Error("The official extensions repository cannot be removed.");
  }
  const installedFromRepo = data.installed.filter(
    (i) => normalizeRepoUrl(i.repoUrl) === normalizeRepoUrl(url),
  );
  if (installedFromRepo.length > 0) {
    const list = installedFromRepo
      .map((i) => `${i.type} ${i.installedAs}`)
      .join(", ");
    throw new Error(`Uninstall these items first: ${list}`);
  }
  const dest = join(getStoreDir(), repo.localPath);
  await rm(dest, { recursive: true, force: true }).catch(() => {});
  data.repos = data.repos.filter(
    (r) => normalizeRepoUrl(r.url) !== normalizeRepoUrl(url),
  );
  await writeReposData(data);
}

export async function refreshRepo(url?: string): Promise<void> {
  const data = await readReposData();
  const repos = url ? [getRepoByUrl(data, url)] : data.repos;
  const toRefresh = repos.filter((r): r is RepoInfo => r != null);
  for (const repo of toRefresh) {
    const repoPath = join(getStoreDir(), repo.localPath);
    try {
      const proc = Bun.spawn(["git", "-C", repoPath, "pull"], {
        stdout: "ignore",
        stderr: "pipe",
      });
      const exit = await proc.exited;
      if (exit !== 0) {
        const err = await new Response(proc.stderr).text();
        repo.error = err || `Git pull failed (${exit})`;
        continue;
      }
      repo.error = null;
      repo.lastFetched = new Date().toISOString();
      const pkgPath = join(repoPath, "package.json");
      const raw = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as RepoPackageJson;
      repo.name = pkg.name ?? repo.name;
      repo.description = pkg.description ?? repo.description;
    } catch (e) {
      repo.error = e instanceof Error ? e.message : String(e);
    }
  }
  await writeReposData(data);
}

export async function refreshAllRepos(): Promise<
  { url: string; error: string | null }[]
> {
  const data = await readReposData();
  const results: { url: string; error: string | null }[] = [];
  for (const repo of data.repos) {
    try {
      await refreshRepo(repo.url);
      const updated = await readReposData();
      const r = getRepoByUrl(updated, repo.url);
      results.push({ url: repo.url, error: r?.error ?? null });
    } catch {
      results.push({ url: repo.url, error: "Refresh failed" });
    }
  }
  return results;
}

async function readAuthorJson(dir: string): Promise<AuthorJson | null> {
  try {
    const raw = await readFile(join(dir, "author.json"), "utf-8");
    const parsed = JSON.parse(raw) as AuthorJson;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

async function listScreenshots(dir: string): Promise<string[]> {
  const screenshotsDir = join(dir, "screenshots");
  try {
    const files = await readdir(screenshotsDir);
    return files.filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  } catch {
    return [];
  }
}

export async function listRepoItems(repoUrl?: string): Promise<StoreItem[]> {
  const data = await readReposData();
  const repos = repoUrl ? [getRepoByUrl(data, repoUrl)] : data.repos;
  const installedSet = new Set(
    data.installed.map(
      (i) => `${normalizeRepoUrl(i.repoUrl)}::${i.type}::${i.itemPath}`,
    ),
  );
  const installedMap = new Map(
    data.installed.map((i) => [
      `${normalizeRepoUrl(i.repoUrl)}::${i.type}::${i.itemPath}`,
      i,
    ]),
  );
  const items: StoreItem[] = [];
  const storeDir = getStoreDir();

  for (const repo of repos) {
    if (!repo) continue;
    const repoPath = join(storeDir, repo.localPath);
    let pkg: RepoPackageJson;
    try {
      const raw = await readFile(join(repoPath, "package.json"), "utf-8");
      pkg = JSON.parse(raw) as RepoPackageJson;
    } catch {
      continue;
    }
    const topAuthor =
      typeof pkg.author === "string"
        ? { name: pkg.author, url: undefined, avatar: undefined }
        : null;

    const push = async (
      type: "plugin" | "theme" | "engine",
      entries: Array<{
        path: string;
        name: string;
        description?: string;
        version?: string;
      }>,
    ) => {
      for (const ent of entries) {
        const itemPath = ent.path.replace(/\/$/, "");
        const fullPath = join(repoPath, itemPath);
        try {
          const st = await stat(fullPath);
          if (!st.isDirectory()) continue;
        } catch {
          continue;
        }
        const author = await readAuthorJson(fullPath);
        const screenshots = await listScreenshots(fullPath);
        const key = `${normalizeRepoUrl(repo.url)}::${type}::${itemPath}`;
        const inst = installedMap.get(key);
        const folderName = itemPath.split("/").pop() ?? itemPath;
        items.push({
          repoUrl: repo.url,
          repoSlug: repo.localPath,
          repoName: repo.name,
          type,
          path: itemPath,
          name: ent.name || folderName,
          description: ent.description ?? "",
          version: ent.version ?? "0.0.0",
          author: author
            ? { name: author.name, url: author.url, avatar: author.avatar }
            : topAuthor,
          screenshots,
          installed: installedSet.has(key),
          installedVersion: inst?.version,
        });
      }
    };

    if (pkg.plugins) await push("plugin", pkg.plugins);
    if (pkg.themes) await push("theme", pkg.themes);
    if (pkg.engines) await push("engine", pkg.engines);
  }

  return items;
}

function getDestDir(type: "plugin" | "theme" | "engine"): string {
  const dataDir = getDataDir();
  if (type === "plugin")
    return process.env.DEGOOG_PLUGINS_DIR ?? join(dataDir, "plugins");
  if (type === "theme")
    return process.env.DEGOOG_THEMES_DIR ?? join(dataDir, "themes");
  return process.env.DEGOOG_ENGINES_DIR ?? join(dataDir, "engines");
}

const STORE_METADATA = ["author.json", "screenshots"];

async function copyItemDir(
  srcDir: string,
  destDir: string,
  exclude: string[],
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    if (exclude.some((x) => e.name === x || e.name.startsWith(x + "/")))
      continue;
    const src = join(srcDir, e.name);
    const dest = join(destDir, e.name);
    if (e.isDirectory()) {
      await copyItemDir(src, dest, []);
    } else {
      await mkdir(dirname(dest), { recursive: true });
      await Bun.write(dest, await Bun.file(src).arrayBuffer());
    }
  }
}

export async function installItem(
  repoUrl: string,
  itemPath: string,
  type: "plugin" | "theme" | "engine",
): Promise<void> {
  const data = await readReposData();
  const repo = getRepoByUrl(data, repoUrl);
  if (!repo) throw new Error("Repository not found.");
  const normalizedPath = itemPath.replace(/\/$/, "");
  const key = `${normalizeRepoUrl(repoUrl)}::${type}::${normalizedPath}`;
  if (
    data.installed.some(
      (i) => `${normalizeRepoUrl(i.repoUrl)}::${i.type}::${i.itemPath}` === key,
    )
  ) {
    throw new Error("Item is already installed.");
  }
  const storeDir = getStoreDir();
  const srcDir = join(storeDir, repo.localPath, normalizedPath);
  try {
    await stat(srcDir);
  } catch {
    throw new Error("Item path not found in repository.");
  }
  const pkgPath = join(storeDir, repo.localPath, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as RepoPackageJson;
  const entries =
    type === "plugin"
      ? pkg.plugins
      : type === "theme"
        ? pkg.themes
        : pkg.engines;
  const manifest = entries?.find(
    (e) => e.path.replace(/\/$/, "") === normalizedPath,
  );
  if (!manifest) throw new Error("Item not listed in package.json.");
  const folderName = normalizedPath.split("/").pop() ?? normalizedPath;
  const destBase = getDestDir(type);
  await mkdir(destBase, { recursive: true });
  const destDir = join(destBase, folderName);
  try {
    await stat(destDir);
    throw new Error(
      `A ${type} named "${folderName}" already exists. Remove it first.`,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("already exists")) throw e;
  }
  await copyItemDir(srcDir, destDir, STORE_METADATA);
  const version = manifest.version ?? "0.0.0";
  data.installed.push({
    repoUrl: repo.url,
    type,
    itemPath: normalizedPath,
    installedAs: folderName,
    installedAt: new Date().toISOString(),
    version,
  });
  await writeReposData(data);
  await reloadAfterAction(type);
}

export async function uninstallItem(
  repoUrl: string,
  itemPath: string,
  type: "plugin" | "theme" | "engine",
): Promise<void> {
  const data = await readReposData();
  const normalizedPath = itemPath.replace(/\/$/, "");
  const inst = data.installed.find(
    (i) =>
      normalizeRepoUrl(i.repoUrl) === normalizeRepoUrl(repoUrl) &&
      i.type === type &&
      i.itemPath === normalizedPath,
  );
  if (!inst) throw new Error("Item is not installed.");
  const destBase = getDestDir(type);
  const destDir = join(destBase, inst.installedAs);
  await rm(destDir, { recursive: true, force: true }).catch(() => {});

  const settingsIds: string[] = [];
  if (type === "plugin") {
    settingsIds.push(`plugin-${inst.installedAs}`, `slot-${inst.installedAs}`);
  } else if (type === "theme") {
    settingsIds.push(`theme-${inst.installedAs}`);
  } else {
    settingsIds.push(`engine-${inst.installedAs}`);
  }
  for (const id of settingsIds) {
    await removeSettings(id);
  }

  data.installed = data.installed.filter((i) => i !== inst);
  await writeReposData(data);
  await reloadAfterAction(type);
}

async function reloadAfterAction(
  type: "plugin" | "theme" | "engine",
): Promise<void> {
  if (type === "plugin") {
    await reloadSlotPlugins();
    await reloadCommands();
    await reloadSearchBarActions();
    await reloadPluginRoutes();
    await reloadMiddlewareRegistry();
  } else if (type === "theme") {
    await reloadThemes();
  } else {
    await reloadEngines();
  }
}

export async function getInstalledItems(): Promise<InstalledItem[]> {
  const data = await readReposData();
  return data.installed;
}

async function ensureOfficialRepo(): Promise<void> {
  const data = await readReposData();
  if (data.repos.length > 0) return;
  const normalized = normalizeRepoUrl(OFFICIAL_REPO_URL);
  if (data.repos.some((r) => normalizeRepoUrl(r.url) === normalized)) return;
  try {
    await addRepo(OFFICIAL_REPO_URL);
  } catch {
    //
  }
}

const FETCH_TIMEOUT_MS = 15_000;

async function getBehindCount(repoPath: string): Promise<number> {
  let remoteRef = "origin/HEAD";
  for (const ref of ["origin/HEAD", "origin/main", "origin/master"]) {
    const proc = Bun.spawn(["git", "-C", repoPath, "rev-parse", ref], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const exit = await proc.exited;
    if (exit === 0) {
      remoteRef = ref;
      break;
    }
  }
  const countProc = Bun.spawn(
    ["git", "-C", repoPath, "rev-list", "--count", `HEAD..${remoteRef}`],
    { stdout: "pipe", stderr: "ignore" },
  );
  const exit = await countProc.exited;
  if (exit !== 0) return 0;
  const out = await new Response(countProc.stdout).text();
  const n = parseInt(out.trim(), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export interface RepoStatus {
  url: string;
  behind: number;
}

export async function getReposStatus(): Promise<RepoStatus[]> {
  const data = await readReposData();
  const storeDir = getStoreDir();
  const results: RepoStatus[] = [];

  for (const repo of data.repos) {
    const repoPath = join(storeDir, repo.localPath);
    try {
      const fetchProc = Bun.spawn(["git", "-C", repoPath, "fetch", "origin"], {
        stdout: "ignore",
        stderr: "pipe",
      });
      await Promise.race([
        fetchProc.exited,
        new Promise<number>((_, rej) =>
          setTimeout(() => {
            fetchProc.kill();
            rej(new Error("Fetch timed out"));
          }, FETCH_TIMEOUT_MS),
        ),
      ]);
    } catch {
      results.push({ url: repo.url, behind: 0 });
      continue;
    }

    try {
      const behind = await getBehindCount(repoPath);
      results.push({ url: repo.url, behind });
    } catch {
      results.push({ url: repo.url, behind: 0 });
    }
  }

  return results;
}

export async function getRepos(): Promise<RepoInfo[]> {
  const data = await readReposData();
  if (data.repos.length === 0) {
    await ensureOfficialRepo();
    const after = await readReposData();
    return after.repos;
  }
  return data.repos;
}

export function getStoreDirPath(): string {
  return getStoreDir();
}

export function getRepoSlugFromUrl(url: string): string {
  return slugFromUrl(url);
}

export function resolveScreenshotPath(
  repoSlug: string,
  itemPath: string,
  filename: string,
): string | null {
  const storeDir = getStoreDir();
  const repoBase = resolve(storeDir, repoSlug);
  const normalized = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (normalized !== filename) return null;
  const full = resolve(repoBase, itemPath, "screenshots", filename);
  const rel = relative(repoBase, full);
  if (rel.startsWith("..") || rel.includes("..")) return null;
  return full;
}
