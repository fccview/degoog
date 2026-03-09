import { escapeHtml } from "../utils/dom";
import { jsonHeaders, authHeaders } from "../utils/request";
import { initLightbox, screenshotUrl } from "./store-lightbox";

const OFFICIAL_REPO_URL =
  "https://github.com/fccview/fccview-degoog-extensions.git";

interface RepoInfo {
  url: string;
  lastFetched: string;
  error?: string;
}

interface StoreItem {
  path: string;
  repoSlug: string;
  repoUrl: string;
  repoName: string;
  name: string;
  description?: string;
  version: string;
  type: "plugin" | "theme" | "engine";
  installed: boolean;
  screenshots: string[];
  author?: { name: string; url?: string };
}

const _normalizeRepoUrl = (url: string): string => {
  const t = (url || "").trim();
  return t.endsWith(".git")
    ? t
    : t + (t.includes("?") || t.includes("#") ? "" : ".git");
};

const _formatRelativeTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
    return `${Math.floor(s / 86400)} days ago`;
  } catch {
    return "";
  }
};

const _renderRepoList = (
  repos: RepoInfo[],
  getToken: () => string | null,
  statusByUrl: Record<string, number>,
): string => {
  if (!repos.length) {
    return '<p class="store-empty">No repositories added. Add a git repository URL to browse its plugins, themes, and engines.</p>';
  }
  let html = '<ul class="store-repo-list">';
  for (const repo of repos) {
    const err = repo.error
      ? `<span class="store-repo-error">${escapeHtml(repo.error)}</span>`
      : "";
    const isOfficial =
      _normalizeRepoUrl(repo.url) === _normalizeRepoUrl(OFFICIAL_REPO_URL);
    const removeBtn = isOfficial
      ? ""
      : `<button class="store-btn store-btn-remove" type="button" data-url="${escapeHtml(repo.url)}">Remove</button>`;
    const normUrl = _normalizeRepoUrl(repo.url);
    const behind = statusByUrl[normUrl] ?? statusByUrl[repo.url] ?? 0;
    const updatesNote =
      behind > 0
        ? `<span class="store-repo-updates-note" title="Refresh to get latest">${escapeHtml(String(behind))} update${behind !== 1 ? "s" : ""} available — refresh to get latest</span>`
        : "";
    html += `
      <li class="store-repo-item" data-url="${escapeHtml(repo.url)}">
        <div class="store-repo-url">${escapeHtml(repo.url)}</div>
        <div class="store-repo-meta">
          Last updated: ${escapeHtml(_formatRelativeTime(repo.lastFetched))}
          ${err}
          ${updatesNote}
        </div>
        <div class="store-repo-actions">
          <button class="store-btn store-btn-refresh" type="button" data-url="${escapeHtml(repo.url)}">Refresh</button>
          ${removeBtn}
        </div>
      </li>`;
  }
  html += "</ul>";
  return html;
};

const _renderItemCard = (
  item: StoreItem,
  getToken: () => string | null,
): string => {
  const itemSlug = item.path.split("/").pop() ?? "";
  const token = getToken();
  const firstUrl = item.screenshots.length
    ? screenshotUrl(
        item.repoSlug,
        item.type,
        itemSlug,
        item.screenshots[0],
        token,
      )
    : "";
  const thumb = item.screenshots.length
    ? `<img src="${firstUrl}" alt="" class="store-card-thumb" loading="lazy">`
    : `<div class="store-card-thumb store-card-thumb-placeholder"></div>`;
  const hasScreenshots = item.screenshots.length > 0;
  const clickableClass = hasScreenshots
    ? " store-card-thumb-wrap--clickable"
    : "";
  const screenshotsData = hasScreenshots
    ? ` data-screenshot-files="${escapeHtml(item.screenshots.join(","))}" data-repo-slug="${escapeHtml(item.repoSlug)}" data-item-type="${escapeHtml(item.type)}" data-item-slug="${escapeHtml(itemSlug)}" data-first-screenshot-url="${escapeHtml(firstUrl)}"`
    : "";
  const thumbA11y = hasScreenshots
    ? ' role="button" tabindex="0" aria-label="View screenshots"'
    : "";
  const author = item.author
    ? item.author.url
      ? `<a href="${escapeHtml(item.author.url)}" target="_blank" rel="noopener">${escapeHtml(item.author.name)}</a>`
      : escapeHtml(item.author.name)
    : "";
  const typeLabel =
    item.type === "plugin"
      ? "Plugin"
      : item.type === "theme"
        ? "Theme"
        : "Engine";
  const btn = item.installed
    ? `<span class="ext-configured-badge"></span><button class="store-btn store-btn-uninstall" type="button" data-repo-url="${escapeHtml(item.repoUrl)}" data-item-path="${escapeHtml(item.path)}" data-type="${escapeHtml(item.type)}">Uninstall</button>`
    : `<button class="store-btn store-btn-install" type="button" data-repo-url="${escapeHtml(item.repoUrl)}" data-item-path="${escapeHtml(item.path)}" data-type="${escapeHtml(item.type)}">Install</button>`;
  return `
    <div class="store-card" data-repo-url="${escapeHtml(item.repoUrl)}" data-item-path="${escapeHtml(item.path)}" data-type="${escapeHtml(item.type)}">
      <div class="store-card-thumb-wrap${clickableClass}"${screenshotsData}${thumbA11y}>${thumb}</div>
      <div class="store-card-body">
        <div class="store-card-main">
          <div class="store-card-name">${escapeHtml(item.name)}</div>
          <div class="store-card-meta">by ${author || "—"} · ${escapeHtml(item.repoName)}</div>
          <div class="store-card-desc">${escapeHtml(item.description || "")}</div>
          <div class="store-card-version">v${escapeHtml(item.version)}</div>
        </div>
        <div class="store-card-footer">
          <span class="store-type-badge store-type-${item.type}">${typeLabel}</span>
          <div class="store-card-actions">${btn}</div>
        </div>
      </div>
    </div>`;
};

const _filterItems = (
  items: StoreItem[],
  typeFilter: string,
  searchQuery: string,
): StoreItem[] => {
  let out = items;
  if (typeFilter && typeFilter !== "all") {
    out = out.filter((i) => i.type === typeFilter);
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    out = out.filter(
      (i) =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)),
    );
  }
  return out;
};

export async function initStoreTab(
  container: HTMLElement,
  getToken: () => string | null,
): Promise<void> {
  if (!container) return;

  let repos: RepoInfo[] = [];
  let items: StoreItem[] = [];
  let repoStatusByUrl: Record<string, number> = {};
  let typeFilter = "all";
  let searchQuery = "";

  async function loadRepos(): Promise<void> {
    const res = await fetch("/api/store/repos", {
      headers: authHeaders(getToken),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { repos?: RepoInfo[] };
    repos = data.repos || [];
  }

  async function loadReposStatus(): Promise<void> {
    const res = await fetch("/api/store/repos/status", {
      headers: authHeaders(getToken),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      statuses?: Array<{ url: string; behind: number }>;
    };
    const statuses = data.statuses || [];
    const map: Record<string, number> = {};
    for (const s of statuses) {
      map[_normalizeRepoUrl(s.url)] = s.behind;
      map[s.url] = s.behind;
    }
    repoStatusByUrl = map;
  }

  async function loadItems(): Promise<void> {
    const res = await fetch("/api/store/items", {
      headers: authHeaders(getToken),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: StoreItem[] };
    items = data.items || [];
  }

  async function refreshAndRender(): Promise<void> {
    await loadRepos();
    await loadItems();
    render();
  }

  function render(): void {
    const repoSection = container.querySelector<HTMLElement>(
      ".store-repos-section",
    );
    const listEl = repoSection?.querySelector<HTMLElement>(
      ".store-repo-list-wrap",
    );
    if (listEl)
      listEl.innerHTML = _renderRepoList(repos, getToken, repoStatusByUrl);

    const catalogSection = container.querySelector<HTMLElement>(
      ".store-catalog-section",
    );
    const grid = catalogSection?.querySelector<HTMLElement>(
      ".store-catalog-grid",
    );
    if (grid) {
      const filtered = _filterItems(items, typeFilter, searchQuery);
      grid.innerHTML = filtered
        .map((item) => _renderItemCard(item, getToken))
        .join("");
      grid
        .querySelectorAll<HTMLButtonElement>(".store-btn-install")
        .forEach((btn) => {
          btn.addEventListener("click", () => void handleInstall(btn));
        });
      grid
        .querySelectorAll<HTMLButtonElement>(".store-btn-uninstall")
        .forEach((btn) => {
          btn.addEventListener("click", () => void handleUninstall(btn));
        });
    }
  }

  function showError(el: HTMLElement | null, msg: string): void {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("store-error-visible");
    setTimeout(() => el.classList.remove("store-error-visible"), 4000);
  }

  async function handleAddRepo(
    inputEl: HTMLInputElement | null,
    addBtn: HTMLButtonElement,
    errorEl: HTMLElement | null,
  ): Promise<void> {
    const url = inputEl?.value?.trim();
    if (!url) return;
    addBtn.disabled = true;
    if (errorEl) errorEl.textContent = "";
    try {
      const res = await fetch("/api/store/repos", {
        method: "POST",
        headers: jsonHeaders(getToken),
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showError(errorEl, data.error || "Failed to add repository");
        return;
      }
      if (inputEl) inputEl.value = "";
      await refreshAndRender();
    } catch {
      showError(errorEl, "Network error");
    } finally {
      addBtn.disabled = false;
    }
  }

  async function handleRefresh(url: string): Promise<void> {
    const res = await fetch("/api/store/repos/refresh", {
      method: "POST",
      headers: jsonHeaders(getToken),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return;
    await refreshAndRender();
    void loadReposStatus().then(() => render());
  }

  async function handleRemove(url: string): Promise<void> {
    const fromRepo = repos.find((r) => r.url === url);
    if (!fromRepo) return;
    const res = await fetch("/api/store/repos", {
      method: "DELETE",
      headers: jsonHeaders(getToken),
      body: JSON.stringify({ url }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error || "Failed to remove repository");
      return;
    }
    await refreshAndRender();
  }

  async function handleInstall(btn: HTMLButtonElement): Promise<void> {
    const { repoUrl, itemPath, type } = btn.dataset;
    if (
      type === "plugin" &&
      !confirm(
        "This plugin will run code on your server. Only install from sources you trust. Continue?",
      )
    )
      return;
    btn.disabled = true;
    try {
      const res = await fetch("/api/store/install", {
        method: "POST",
        headers: jsonHeaders(getToken),
        body: JSON.stringify({ repoUrl, itemPath, type }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) alert(data.error || "Install failed");
      else await loadItems().then(() => render());
    } catch {
      alert("Network error");
    } finally {
      btn.disabled = false;
    }
  }

  async function handleUninstall(btn: HTMLButtonElement): Promise<void> {
    const { repoUrl, itemPath, type } = btn.dataset;
    if (!confirm(`Uninstall this ${type ?? "item"}?`)) return;
    btn.disabled = true;
    try {
      const res = await fetch("/api/store/uninstall", {
        method: "POST",
        headers: jsonHeaders(getToken),
        body: JSON.stringify({ repoUrl, itemPath, type }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) alert(data.error || "Uninstall failed");
      else await loadItems().then(() => render());
    } catch {
      alert("Network error");
    } finally {
      btn.disabled = false;
    }
  }

  container.innerHTML = `
    <section class="store-repos-section settings-section">
      <div class="store-repos-header">
        <h2 class="settings-section-heading">Repositories</h2>
        <button class="store-btn store-btn-add" type="button">Add</button>
      </div>
      <div class="store-add-repo-wrap" style="display:none">
        <input type="text" class="store-input-url" placeholder="https://github.com/user/repo.git">
        <button class="store-btn store-btn-add-confirm" type="button">Add repository</button>
        <span class="store-inline-error"></span>
      </div>
      <p class="settings-desc">Add a git repository URL to browse and install plugins, themes, and engines from it.</p>
      <div class="store-repo-list-wrap"></div>
      <div class="store-repos-actions">
        <button class="store-btn store-btn-refresh-all" type="button">Refresh All</button>
      </div>
    </section>
    <section class="store-catalog-section settings-section">
      <h2 class="settings-section-heading">Store</h2>
      <div class="store-catalog-filters">
        <div class="store-filter-btns">
          <button class="store-filter-btn active" data-filter="all" type="button">All</button>
          <button class="store-filter-btn" data-filter="plugin" type="button">Plugins</button>
          <button class="store-filter-btn" data-filter="theme" type="button">Themes</button>
          <button class="store-filter-btn" data-filter="engine" type="button">Engines</button>
        </div>
        <input type="text" class="store-search-input" placeholder="Search…">
      </div>
      <div class="store-catalog-grid"></div>
    </section>
    <div class="store-lightbox" id="store-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Screenshot gallery">
      <div class="store-lightbox-backdrop"></div>
      <button class="store-lightbox-close" type="button" aria-label="Close">&times;</button>
      <button class="store-lightbox-prev" type="button" aria-label="Previous">&larr;</button>
      <div class="store-lightbox-img-wrap">
        <img class="store-lightbox-img" src="" alt="">
      </div>
      <button class="store-lightbox-next" type="button" aria-label="Next">&rarr;</button>
      <div class="store-lightbox-counter"></div>
    </div>`;

  initLightbox(container, getToken);

  const addWrap = container.querySelector<HTMLElement>(".store-add-repo-wrap");
  const addBtn = container.querySelector<HTMLButtonElement>(".store-btn-add");
  const addConfirmBtn = container.querySelector<HTMLButtonElement>(
    ".store-btn-add-confirm",
  );
  const urlInput =
    container.querySelector<HTMLInputElement>(".store-input-url");
  const addErrorEl = container.querySelector<HTMLElement>(
    ".store-inline-error",
  );

  addBtn?.addEventListener("click", () => {
    if (addWrap)
      addWrap.style.display =
        addWrap.style.display === "none" ? "block" : "none";
  });
  addConfirmBtn?.addEventListener("click", () => {
    if (addConfirmBtn) void handleAddRepo(urlInput, addConfirmBtn, addErrorEl);
  });

  container
    .querySelector<HTMLButtonElement>(".store-btn-refresh-all")
    ?.addEventListener("click", async () => {
      const btn = container.querySelector<HTMLButtonElement>(
        ".store-btn-refresh-all",
      );
      if (btn) btn.disabled = true;
      try {
        await fetch("/api/store/repos/refresh", {
          method: "POST",
          headers: jsonHeaders(getToken),
          body: JSON.stringify({}),
        });
        await refreshAndRender();
        void loadReposStatus().then(() => render());
      } finally {
        if (btn) btn.disabled = false;
      }
    });

  container.addEventListener("click", (e) => {
    const refreshBtn = (e.target as HTMLElement).closest<HTMLElement>(
      ".store-btn-refresh",
    );
    const removeBtn = (e.target as HTMLElement).closest<HTMLElement>(
      ".store-btn-remove",
    );
    if (refreshBtn?.dataset.url) void handleRefresh(refreshBtn.dataset.url);
    if (removeBtn?.dataset.url) {
      if (
        confirm(
          "Remove this repository? You must uninstall any installed items first.",
        )
      ) {
        void handleRemove(removeBtn.dataset.url);
      }
    }
  });

  container
    .querySelectorAll<HTMLButtonElement>(".store-filter-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        container
          .querySelectorAll<HTMLButtonElement>(".store-filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        typeFilter = btn.dataset.filter || "all";
        render();
      });
    });

  const searchInput = container.querySelector<HTMLInputElement>(
    ".store-search-input",
  );
  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value || "";
    render();
  });

  try {
    await refreshAndRender();
    void loadReposStatus().then(() => render());
  } catch {
    const wrap = container.querySelector<HTMLElement>(".store-repo-list-wrap");
    if (wrap)
      wrap.innerHTML = '<p class="store-empty">Failed to load store.</p>';
  }
}
