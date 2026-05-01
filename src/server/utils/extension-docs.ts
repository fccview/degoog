import { access } from "fs/promises";
import { join } from "path";
import { enginesDir, pluginsDir, themesDir, transportsDir } from "./paths";

type ExtensionDocsPath = { readmePath: string; exists: boolean };

const _destDirFromId = (id: string): string | null => {
  if (id.startsWith("plugin-") || id.startsWith("slot-")) return pluginsDir();
  if (id.startsWith("theme-")) return themesDir();
  if (id.startsWith("transport-")) return transportsDir();
  if (id.startsWith("engine-")) return enginesDir();
  return null;
};

export const getExtensionReadmePath = (id: string): string | null => {
  const base = _destDirFromId(id);
  if (!base) return null;
  const folder = id.replace(/^[a-z-]+-/, "");
  if (!folder.trim()) return null;
  return join(base, folder, "README.md");
};

export const extensionReadmeExists = async (
  id: string,
): Promise<ExtensionDocsPath> => {
  const readmePath = getExtensionReadmePath(id);
  if (!readmePath) return { readmePath: "", exists: false };
  try {
    await access(readmePath);
    return { readmePath, exists: true };
  } catch {
    return { readmePath, exists: false };
  }
};

