import { state } from "../../state";
import { MAX_PAGE } from "../../constants";
import { cleanUrl } from "../../utils/dom";
import { faviconUrl, proxyImageUrl } from "../../utils/url";
import { buildPaginationHtml } from "../../utils/pagination";
import { setupMediaObserver, destroyMediaObserver } from "../media/media";
import { renderImageGrid, renderVideoGrid } from "./render-media";
import { goToPage } from "../../utils/search-actions";
import { renderTemplate } from "../../utils/template";
import type { ScoredResult } from "../../types";

import { clearSlotPanels as _clearSlots } from "./render-slots";

export {
  clearSlotPanels,
  renderSlotPanels,
  appendSlotPanels,
  renderAtAGlance,
} from "./render-slots";
export { renderSidebar } from "./render-sidebar";

export const buildResultContext = (
  r: ScoredResult,
): Record<string, unknown> => ({
  title: r.title,
  url: r.url,
  cite_url: cleanUrl(r.url),
  snippet: r.snippet,
  favicon_url: faviconUrl(r.url),
  thumbnail_url: r.thumbnail ? proxyImageUrl(r.thumbnail) : "",
  sources: r.sources,
  duration: r.duration || "",
  link_target: state.openInNewTab ? "_blank" : "_self",
  link_rel: state.openInNewTab ? "noopener" : "",
});

export function renderResults(results: ScoredResult[]): void {
  const container = document.getElementById("results-list");
  const layout = document.getElementById("results-layout");
  if (!container || !layout) return;

  if (state.currentType === "images" || state.currentType === "videos") {
    layout.classList.add("media-mode");
  } else {
    layout.classList.remove("media-mode");
  }

  if (results.length === 0) {
    container.innerHTML = '<div class="no-results">No results found.</div>';
    if (state.currentType !== "images" && state.currentType !== "videos") {
      renderPagination(MAX_PAGE, state.currentPage);
    }

    return;
  }

  if (state.currentType === "images") {
    renderImageGrid(results, container);
    setupMediaObserver("images");
    _clearSlots();
    const pagination = document.getElementById("pagination");
    if (pagination) pagination.innerHTML = "";
    return;
  }
  if (state.currentType === "videos") {
    renderVideoGrid(results, container);
    setupMediaObserver("videos");
    _clearSlots();
    const pagination = document.getElementById("pagination");
    if (pagination) pagination.innerHTML = "";
    return;
  }

  destroyMediaObserver();

  container.innerHTML = results
    .map((r) => renderTemplate("degoog-result", buildResultContext(r)) ?? "")
    .join("");

  renderPagination(MAX_PAGE, state.currentPage);
}

export function renderPagination(totalPages: number, activePage: number): void {
  const container = document.getElementById("pagination");
  if (!container) return;
  if (totalPages < 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `<div class="pagination">${buildPaginationHtml(totalPages, activePage)}</div>`;

  container.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const pageNum = parseInt(el.dataset.page ?? "0", 10);
      if (pageNum >= 1 && pageNum <= MAX_PAGE) void goToPage(pageNum);
    });
  });
}
