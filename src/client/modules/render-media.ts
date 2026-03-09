import { state } from "../state";
import { escapeHtml, cleanHostname } from "../utils/dom";
import { proxyImageUrl } from "../utils/url";
import { openMediaPreview, registerAppendMediaCards } from "./media";
import type { ScoredResult } from "../types";

export function appendMediaCards(
  grid: HTMLElement,
  results: ScoredResult[],
  type: "image" | "video",
): void {
  const startIdx = grid.children.length;
  const cardClass = type === "image" ? "image-card" : "video-card";
  const selector = `.${cardClass}`;

  const fragment = document.createDocumentFragment();
  results.forEach((r, i) => {
    const idx = startIdx + i;
    const card = document.createElement("div");
    card.className = cardClass;
    card.dataset.idx = String(idx);

    if (type === "image") {
      card.innerHTML = `
        <div class="image-thumb-wrap">
          <img class="image-thumb" src="${escapeHtml(proxyImageUrl(r.thumbnail || ""))}" alt="${escapeHtml(r.title)}" loading="lazy" onerror="this.parentElement.parentElement.style.display='none'">
        </div>
        <div class="image-info">
          <span class="image-title">${escapeHtml(r.title)}</span>
          <span class="image-source">${escapeHtml(cleanHostname(r.url))}</span>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="video-thumb-wrap">
          <img class="video-thumb" src="${escapeHtml(proxyImageUrl(r.thumbnail || ""))}" alt="${escapeHtml(r.title)}" loading="lazy" onerror="this.style.display='none'">
          ${r.duration ? `<span class="video-duration">${escapeHtml(r.duration)}</span>` : ""}
          <div class="video-play-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        <div class="video-info">
          <span class="video-title">${escapeHtml(r.title)}</span>
          <span class="video-source">${escapeHtml(cleanHostname(r.url))}</span>
        </div>`;
    }

    card.addEventListener("click", () => {
      openMediaPreview(state.currentResults[idx], idx, selector);
    });

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

registerAppendMediaCards(appendMediaCards);

export function renderImageGrid(results: ScoredResult[], container: HTMLElement): void {
  let grid = container.querySelector<HTMLElement>(".image-grid");
  if (!grid) {
    container.innerHTML = '<div class="image-grid"></div><div class="media-scroll-sentinel"></div>';
    grid = container.querySelector<HTMLElement>(".image-grid")!;
  }
  appendMediaCards(grid, results, "image");
}

export function renderVideoGrid(results: ScoredResult[], container: HTMLElement): void {
  let grid = container.querySelector<HTMLElement>(".video-grid");
  if (!grid) {
    container.innerHTML = '<div class="video-grid"></div><div class="media-scroll-sentinel"></div>';
    grid = container.querySelector<HTMLElement>(".video-grid")!;
  }
  appendMediaCards(grid, results, "video");
}
