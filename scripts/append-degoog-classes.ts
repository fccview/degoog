import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

export type ClassMapping = Readonly<{
  newClass: string;
  oldClasses: readonly string[];
}>;

export const CLASS_MAPPINGS: readonly ClassMapping[] = [
  {
    newClass: "degoog-panel",
    oldClasses: ["ext-card", "sidebar-panel", "results-slot-panel"],
  },
  {
    newClass: "degoog-dropdown",
    oldClasses: ["tools-dropdown", "tools-submenu", "result-actions-menu"],
  },
  {
    newClass: "degoog-search-bar",
    oldClasses: ["search-bar", "results-search-bar", "settings-nav-search"],
  },
  {
    newClass: "degoog-input",
    oldClasses: [
      "store-input-url",
      "ext-field-input",
      "ext-field-urllist-input",
      "settings-rate-limit-input",
      "settings-proxy-urls",
      "settings-score-domain",
      "settings-score-value",
      "store-search-input",
      "tools-date-input",
      "tools-lang-filter",
    ],
  },
  {
    newClass: "degoog-select-wrap",
    oldClasses: ["theme-select-wrap", "settings-nav-mobile", "ext-field-select-wrap"],
  },
  {
    newClass: "degoog-toggle-wrap",
    oldClasses: ["settings-toggle-wrap", "engine-toggle"],
  },
  {
    newClass: "degoog-toggle",
    oldClasses: ["toggle-slider"],
  },
  {
    newClass: "degoog-accordion-toggle",
    oldClasses: ["sidebar-accordion-toggle", "store-updates-toggle"],
  },
  {
    newClass: "degoog-tab",
    oldClasses: ["results-tab", "tools-toggle"],
  },
  {
    newClass: "degoog-menu-item",
    oldClasses: ["tools-menu-item", "tools-option", "result-actions-item"],
  },
  {
    newClass: "degoog-badge",
    oldClasses: ["result-engine-tag", "store-type-badge", "store-subtype-badge", "glance-ai-badge"],
  },
  {
    newClass: "degoog-icon-btn",
    oldClasses: ["search-submit-btn", "settings-gear", "img-lightbox-close", "ext-modal-close", "media-preview-close"],
  },
] as const;

const EXCLUDED_DIRS = new Set(["node_modules", "stores", "data", ".git"]);
const ALLOWED_EXTS = new Set([".html", ".htm", ".js", ".ts", ".tsx"]);

const uniq = (items: readonly string[]): string[] => [...new Set(items)];
const splitClasses = (classValue: string): string[] => classValue.split(/\s+/).map((c) => c.trim()).filter(Boolean);
const joinClasses = (classes: readonly string[]): string => classes.join(" ");

export const appendDeoogClassesToClassValue = (
  classValue: string,
  mappings: readonly ClassMapping[] = CLASS_MAPPINGS,
): string => {
  const classes = splitClasses(classValue);
  const next = new Set(classes);

  for (const m of mappings) {
    const hasOld = m.oldClasses.some((c) => next.has(c));
    if (hasOld) next.add(m.newClass);
  }

  const out = uniq([...next]);
  return joinClasses(out);
};

export const appendDeoogClassesInText = (
  input: string,
  mappings: readonly ClassMapping[] = CLASS_MAPPINGS,
): string => {
  let out = input;

  out = out.replace(/class=(["'])([^"']*)(\1)/g, (_m, q: string, v: string) => {
    const next = appendDeoogClassesToClassValue(v, mappings);
    return `class=${q}${next}${q}`;
  });

  out = out.replace(/className\s*=\s*(["'])([^"']*)(\1)/g, (_m, q: string, v: string) => {
    const next = appendDeoogClassesToClassValue(v, mappings);
    return `className=${q}${next}${q}`;
  });

  out = out.replace(/\.className\s*=\s*(["'])([^"']*)(\1)/g, (_m, q: string, v: string) => {
    const next = appendDeoogClassesToClassValue(v, mappings);
    return `.className=${q}${next}${q}`;
  });

  out = out.replace(/classList\.add\(([^)]*)\)/g, (full: string, argsRaw: string) => {
    const args = argsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const stringArgs = args
      .map((a) => {
        const m = a.match(/^["']([^"']*)["']$/);
        return m ? { raw: a, val: m[1] } : null;
      })
      .filter((v): v is { raw: string; val: string } => v !== null);

    if (stringArgs.length === 0) return full;

    const existing = new Set(stringArgs.map((a) => a.val));
    const toAdd: string[] = [];

    for (const m of mappings) {
      if (existing.has(m.newClass)) continue;
      if (m.oldClasses.some((c) => existing.has(c))) toAdd.push(m.newClass);
    }

    if (toAdd.length === 0) return full;

    const q = stringArgs[0].raw.startsWith("'") ? "'" : '"';
    const appended = [...args, ...toAdd.map((c) => `${q}${c}${q}`)].join(", ");
    return `classList.add(${appended})`;
  });

  return out;
};

export type ProcessOptions = Readonly<{
  dryRun?: boolean;
  mappings?: readonly ClassMapping[];
  rootLabel?: string;
}>;

const shouldSkipDir = (dirName: string): boolean => EXCLUDED_DIRS.has(dirName);
const isAllowedFile = (path: string): boolean => ALLOWED_EXTS.has(extname(path));

export const processPath = async (targetPath: string, options: ProcessOptions = {}): Promise<number> => {
  const s = await stat(targetPath);
  if (s.isDirectory()) return await processDir(targetPath, options);
  if (!s.isFile() || !isAllowedFile(targetPath)) return 0;
  return await processFile(targetPath, options);
};

const processDir = async (dirPath: string, options: ProcessOptions): Promise<number> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  let changed = 0;

  for (const e of entries) {
    if (e.isDirectory()) {
      if (shouldSkipDir(e.name)) continue;
      changed += await processDir(join(dirPath, e.name), options);
      continue;
    }

    if (!e.isFile()) continue;
    const p = join(dirPath, e.name);
    if (!isAllowedFile(p)) continue;
    changed += await processFile(p, options);
  }

  return changed;
};

const processFile = async (filePath: string, options: ProcessOptions): Promise<number> => {
  const before = await readFile(filePath, "utf8");
  const after = appendDeoogClassesInText(before, options.mappings ?? CLASS_MAPPINGS);
  if (after === before) return 0;

  if (!options.dryRun) await writeFile(filePath, after, "utf8");
  const label = options.rootLabel ? `${options.rootLabel}: ` : "";
  process.stdout.write(`${label}${relative(process.cwd(), filePath)}\n`);
  return 1;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--")) ?? ".";
  const dryRun = args.includes("--dry-run");
  const changed = await processPath(target, { dryRun, rootLabel: "updated" });
  process.stdout.write(`changed=${changed}\n`);
};

if (import.meta.main) {
  await main();
}
