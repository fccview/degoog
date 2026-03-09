import { performSearch } from "./search";
import { showHome } from "./navigation";
import { initAutocomplete } from "./autocomplete";
import { initLuckySlot } from "./luckySlot";
import { initTabs } from "./tabs";
import { initMediaPreview } from "./mediaPreview";
import { initTheme } from "./theme";
import { initTimeFilter } from "./timeFilter";
import { initHomeFeed } from "./homeFeed";
import { initInstallPrompt } from "./installPrompt";
import { initSearchBarActions } from "./searchBarActions";

function _copyToClipboardFallback(text: string, onSuccess: () => void): void {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand("copy");
    onSuccess();
  } finally {
    document.body.removeChild(el);
  }
}

export function init(): void {
  const searchInput = document.getElementById("search-input") as HTMLInputElement | null;
  const resultsInput = document.getElementById("results-search-input") as HTMLInputElement | null;

  resultsInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && resultsInput) void performSearch(resultsInput.value);
  });

  document.getElementById("results-search-btn")?.addEventListener("click", () => {
    if (resultsInput) void performSearch(resultsInput.value);
  });

  document.querySelector(".results-logo")?.addEventListener("click", (e) => {
    e.preventDefault();
    showHome();
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
  });

  initAutocomplete(
    searchInput,
    document.getElementById("ac-dropdown-home"),
    (q) => void performSearch(q),
  );
  initAutocomplete(
    resultsInput,
    document.getElementById("ac-dropdown-results"),
    (q) => void performSearch(q),
  );
  initSearchBarActions();
  initLuckySlot();
  initTabs();
  initMediaPreview();
  void initTheme();
  initTimeFilter();
  initInstallPrompt();

  document.body.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".uuid-copy");
    if (!btn || !btn.dataset.uuid) return;
    e.preventDefault();
    e.stopPropagation();
    const uuid = btn.dataset.uuid;
    const done = (): void => {
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(uuid).then(done).catch(() => {
        _copyToClipboardFallback(uuid, done);
      });
    } else {
      _copyToClipboardFallback(uuid, done);
    }
  });

  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const type = params.get("type") || "all";
  const page = parseInt(params.get("page") ?? "1", 10) || 1;
  if (q) {
    if (searchInput) searchInput.value = q;
    void performSearch(q, type, page);
  } else {
    void initHomeFeed();
  }
}
