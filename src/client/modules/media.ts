import { state } from "../state";
import { getEngines } from "./engines";
import { buildSearchUrl, proxyImageUrl } from "../utils/url";
import { escapeHtml, cleanHostname } from "../utils/dom";
import type { ScoredResult } from "../types";

let mediaObserver: IntersectionObserver | null = null;
let appendMediaCardsRef: ((grid: HTMLElement, results: ScoredResult[], type: "image" | "video") => void) | null = null;

export function registerAppendMediaCards(
  fn: (grid: HTMLElement, results: ScoredResult[], type: "image" | "video") => void,
): void {
  appendMediaCardsRef = fn;
}

export function destroyMediaObserver(): void {
  if (mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
}

export function setupMediaObserver(type: string): void {
  destroyMediaObserver();
  const sentinel = document.querySelector<HTMLElement>(".media-scroll-sentinel");
  if (!sentinel) return;

  mediaObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !state.mediaLoading) {
        void loadMoreMedia(type);
      }
    },
    { rootMargin: "400px" },
  );

  mediaObserver.observe(sentinel);
}

export async function loadMoreMedia(type: string): Promise<void> {
  const page = type === "images" ? state.imagePage : state.videoPage;
  const lastPg = type === "images" ? state.imageLastPage : state.videoLastPage;
  const nextPage = page + 1;
  if (nextPage > lastPg || state.mediaLoading) return;

  state.mediaLoading = true;
  const sentinel = document.querySelector<HTMLElement>(".media-scroll-sentinel");
  if (sentinel) sentinel.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  const engines = await getEngines();
  const url = buildSearchUrl(state.currentQuery, engines, type, nextPage);
  try {
    const res = await fetch(url);
    const data = (await res.json()) as { results: ScoredResult[] };
    if (data.results.length === 0) {
      if (type === "images") state.imageLastPage = page;
      else state.videoLastPage = page;
    } else {
      state.currentResults = state.currentResults.concat(data.results);
      if (type === "images") state.imagePage = nextPage;
      else state.videoPage = nextPage;

      const container = document.getElementById("results-list");
      const grid = container?.querySelector<HTMLElement>(
        type === "images" ? ".image-grid" : ".video-grid",
      );
      if (grid && appendMediaCardsRef) {
        appendMediaCardsRef(grid, data.results, type === "images" ? "image" : "video");
      }
    }
  } finally {
    state.mediaLoading = false;
    if (sentinel) sentinel.innerHTML = "";
  }
}

export function openMediaPreview(item: ScoredResult, idx: number, cardSelector: string): void {
  const panel = document.getElementById("media-preview-panel");
  const img = document.getElementById("media-preview-img") as HTMLImageElement | null;
  const info = document.getElementById("media-preview-info");

  if (img) img.src = proxyImageUrl(item.thumbnail || "") || "";
  if (info) {
    info.innerHTML = `
      <h3 class="media-preview-title">${escapeHtml(item.title)}</h3>
      <a class="media-preview-link" href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(cleanHostname(item.url))}</a>
      <a class="media-preview-visit" href="${escapeHtml(item.url)}" target="_blank">Visit page</a>
    `;
  }

  panel?.classList.add("open");

  document.querySelectorAll<HTMLElement>(cardSelector).forEach((c) => c.classList.remove("selected"));
  document.querySelector<HTMLElement>(`${cardSelector}[data-idx="${idx}"]`)?.classList.add("selected");
}

export function closeMediaPreview(): void {
  document.getElementById("media-preview-panel")?.classList.remove("open");
  document.querySelectorAll<HTMLElement>(".image-card, .video-card").forEach((c) =>
    c.classList.remove("selected"),
  );
}
