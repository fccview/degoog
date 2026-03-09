import { idbGet, idbSet } from "../utils/db";
import { THEME_KEY } from "../constants";
import { applyTheme } from "../modules/theme";
import { requestInstallPrompt } from "../modules/installPrompt";
import { authHeaders, jsonHeaders } from "../utils/request";
import { debug } from "../../logger";

export async function initGeneralTab(
  getToken: () => string | null,
): Promise<void> {
  const themeSelect = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement | null;
  if (themeSelect) {
    const saved = await idbGet<string>(THEME_KEY);
    themeSelect.value = saved || "system";
  }

  const proxyEnabled = document.getElementById(
    "settings-proxy-enabled",
  ) as HTMLInputElement | null;
  const proxyUrlsWrap = document.getElementById("settings-proxy-urls-wrap");
  const proxyUrls = document.getElementById(
    "settings-proxy-urls",
  ) as HTMLTextAreaElement | null;
  if (proxyEnabled && proxyUrlsWrap && proxyUrls) {
    try {
      const res = await fetch("/api/settings/general", {
        headers: authHeaders(getToken),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          proxyEnabled?: string;
          proxyUrls?: string;
        };
        proxyEnabled.checked = data.proxyEnabled === "true";
        proxyUrls.value = data.proxyUrls ?? "";
        proxyUrlsWrap.style.display = proxyEnabled.checked ? "block" : "none";
      }
    } catch (error) {
      debug("general", "Failed to fetch proxy settings", error);
    }
    proxyEnabled.addEventListener("change", () => {
      proxyUrlsWrap.style.display = proxyEnabled?.checked ? "block" : "none";
    });
  }

  document
    .getElementById("settings-save")
    ?.addEventListener("click", async () => {
      if (themeSelect) {
        const value = themeSelect.value;
        await idbSet(THEME_KEY, value);
        try {
          localStorage.setItem(THEME_KEY, value);
        } catch (error) {
          debug("general", "Failed to set theme in localStorage", error);
        }
        applyTheme(value);
      }
      if (proxyEnabled && proxyUrls) {
        try {
          await fetch("/api/settings/general", {
            method: "POST",
            headers: jsonHeaders(getToken),
            body: JSON.stringify({
              proxyEnabled: proxyEnabled.checked ? "true" : "false",
              proxyUrls: proxyUrls.value.trim(),
            }),
          });
        } catch (error) {
          debug("general", "Failed to save proxy settings", error);
        }
      }
      const btn = document.getElementById("settings-save");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Saved";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      }
    });

  document
    .getElementById("settings-cache-clear")
    ?.addEventListener("click", async () => {
      const btn = document.getElementById("settings-cache-clear");
      try {
        await fetch("/api/cache/clear", { method: "POST" });
        if (btn) {
          const prev = btn.textContent;
          btn.textContent = "Cleared";
          setTimeout(() => {
            btn.textContent = prev;
          }, 1500);
        }
      } catch {
        if (btn) btn.textContent = "Failed";
      }
    });

  document
    .getElementById("settings-install-prompt")
    ?.addEventListener("click", () => requestInstallPrompt());
}
