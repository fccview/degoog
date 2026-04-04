import { pathToFileURL } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Translate, TranslationRecord, TranslationVars } from "../types";
import { debug } from "./logger";

/**
 * Returns the closest available language based on the provided language and available languages.
 * @param lang The desired language (e.g., "en-US").
 * @param availableLangs An array of available languages (e.g., ["en", "en-GB", "fr"]).
 * @returns The closest matching language from the available languages, or "en" if no match is found.
 */
export const getClosestLanguage = (
  lang: string,
  availableLangs: string[],
): string | null => {
  if (availableLangs.includes(lang)) return lang;

  const baseLang = lang.split("-")[0];

  if (availableLangs.map((l) => l.split("-")[0]).includes(baseLang))
    return baseLang;

  debug(
    "translation",
    `No exact match for language "${lang}" or its base language "${baseLang}".`,
  );
  return null;
};

/**
 * Dynamically imports all translation files from an extension path.
 * @param path The directory path where translation files are located.
 * @returns A promise that resolves to the translation record object, or an empty object if an error occurs.
 */
export const dynamicImportTranslationFiles = async (
  path: string,
): Promise<TranslationRecord> => {
  const files = await readdir(join(path, "locales")).catch((e) => {
    debug(
      "translation",
      `Error reading translation directory at path "${path}":`,
      e,
    );
    return [];
  });

  const translations: TranslationRecord = {};

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const lang = file.substring(0, file.length - 5);
    const url = pathToFileURL(join(path, "locales", file)).href;

    try {
      const mod = await import(url);
      const translation = mod.default || mod;

      if (typeof translation === "object" && translation !== null) {
        translations[lang] = translation;
      } else {
        debug(
          "translation",
          `Translation file for language "${lang}" at path "${path}" does not export an object.`,
        );
      }
    } catch (e) {
      debug(
        "translation",
        `Error loading translation file for language "${lang}" at path "${path}":`,
        e,
      );
    }
  }

  return translations;
};

export const createTranslator = (translations: TranslationRecord) => {
  let locale = "en";

  return Object.assign(
    function (
      key: string,
      vars?: TranslationVars[] | Record<string, TranslationVars>,
    ) {
      const localeList = Object.keys(translations);
      const closestLang = getClosestLanguage(locale, localeList);

      if (!closestLang) {
        debug(
          "translation",
          `No available translations for locale "${locale}". Available languages: ${localeList.join(
            ", ",
          )}`,
        );
        return key;
      }

      // Split the keys and reduce translation object to find the value
      // If this isn't readable enough tell me, i'll use for loop c:
      const keys = key.split(".");
      const value = keys.reduce<
        TranslationVars | TranslationRecord | undefined
      >((acc, k) => {
        if (typeof acc === "object" && acc !== null && k in acc) return acc[k];
        return undefined;
      }, translations[closestLang]);

      if (typeof value === "object" || typeof value === "undefined") {
        debug(
          "translation",
          `Translation for key "${key}" in language "${locale}" is missing.`,
        );
        return key;
      }

      if (typeof value !== "string" || !vars) return value;

      if (Array.isArray(vars)) {
        return vars.reduce<string>(
          (str, v) => str.replace(/\{[^}]+\}/, String(v)),
          value,
        );
      } else {
        return Object.entries(vars).reduce(
          (str, [k, v]) =>
            str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
          value,
        );
      }
    },
    {
      setLocale: function (newLocale: string) {
        locale = newLocale;
      },
      get locale() {
        return locale;
      },
    },
  );
};

export const createTranslatorFromPath = async (path: string) => {
  const translations = await dynamicImportTranslationFiles(path);
  return createTranslator(translations);
};

export const withFallback = (
  primary: Translate,
  fallback: Translate,
): Translate => {
  return Object.assign(
    function (
      key: string,
      vars?: TranslationVars[] | Record<string, TranslationVars>,
    ) {
      const result = primary(key, vars);
      if (result === key) return fallback(key, vars);
      return result;
    },
    {
      setLocale: function (newLocale: string) {
        primary.setLocale(newLocale);
        fallback.setLocale(newLocale);
      },
      get locale() {
        return primary.locale;
      },
    },
  );
};

const TEMPLATE_DIRECTIVE_PREFIXES = ["#if", "/if", "#each", "/each"] as const;

const TEMPLATE_RESERVED_KEYS = new Set([
  ".",
  "@index",
  "title",
  "url",
  "snippet",
  "cite_url",
  "favicon_url",
  "thumbnail_url",
  "hostname",
  "link_target",
  "link_rel",
  "sources",
  "sources_text",
  "duration",
  "content",
]);

const isTemplateKey = (key: string): boolean => {
  if (TEMPLATE_RESERVED_KEYS.has(key)) return true;
  return TEMPLATE_DIRECTIVE_PREFIXES.some((p) => key.startsWith(p));
};

export const translateHTML = (
  html: string,
  t: ReturnType<typeof createTranslator>,
): string => {
  // Remove <script>...</script> blocks, translate, then restore them
  const scripts: string[] = [];
  const placeholder = (i: number) => `<!--__SCRIPT_BLOCK_${i}__-->`;

  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
    scripts.push(match);
    return placeholder(scripts.length - 1);
  });

  const translated = stripped.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (match, content: string) => {
      const parts = content.split(",").map((p) => p.trim());
      const key = parts[0];

      if (isTemplateKey(key)) return match;

      const vars = parts.slice(1);
      const value = vars.length > 0 ? t(key, vars) : t(key);

      return String(value);
    },
  );

  // Restore script blocks
  return translated.replace(
    /<!--__SCRIPT_BLOCK_(\d+)__-->/g,
    (_, i) => scripts[Number(i)],
  );
};
