export const cleanUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch {
    return url;
  }
};

export const cleanHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

export const isConfigured = (ext: {
  settingsSchema: Array<{ required?: boolean; key: string }>;
  settings: Record<string, string | string[]>;
}): boolean =>
  ext.settingsSchema
    .filter((f) => f.required)
    .every((f) => {
      const v = ext.settings[f.key];
      return !!v && v !== "";
    });
