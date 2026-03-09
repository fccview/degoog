import { proxyImageUrl } from "../utils/url";
import { escapeHtml, cleanHostname } from "../utils/dom";
import { getEngines } from "./engines";
import { skeletonFeedCards } from "./skeleton";
import type { NewsItem } from "../types";

const RSS_NEWS_ENGINE_ID = "rss-news";

let feedPage = 1;
let loading = false;
let exhausted = false;
let observer: IntersectionObserver | null = null;

const _renderCard = (item: NewsItem): string => {
  const thumb = item.thumbnail
    ? `<img class="home-feed-card-img" src="${escapeHtml(proxyImageUrl(item.thumbnail))}" alt="" loading="lazy" onerror="this.parentElement.querySelector('.home-feed-card-img')?.remove()">`
    : "";
  const source = (item.sources && item.sources[0]) || cleanHostname(item.url);
  return `<a class="home-feed-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
    ${thumb}
    <div class="home-feed-card-body">
      <div class="home-feed-card-source">${escapeHtml(source)}</div>
      <div class="home-feed-card-title">${escapeHtml(item.title)}</div>
    </div>
  </a>`;
};

const _fetchPage = async (page: number): Promise<NewsItem[]> => {
  const res = await fetch(`/api/search?type=news&q=&page=${page}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: NewsItem[] };
  return data.results || [];
};

async function _loadMore(container: HTMLElement): Promise<void> {
  if (loading || exhausted) return;
  loading = true;

  const items = await _fetchPage(feedPage);
  if (items.length === 0) {
    exhausted = true;
    container.querySelector(".home-feed-sentinel")?.remove();
    loading = false;
    return;
  }

  const sentinel = container.querySelector(".home-feed-sentinel");
  const fragment = document.createDocumentFragment();
  const temp = document.createElement("div");
  temp.innerHTML = items.map(_renderCard).join("");
  while (temp.firstChild) fragment.appendChild(temp.firstChild);
  container.insertBefore(fragment, sentinel ?? null);

  feedPage++;
  loading = false;
}

const _isDesktop = (): boolean => window.matchMedia("(min-width: 768px)").matches;

export async function initHomeFeed(): Promise<void> {
  const container = document.getElementById("home-news-feed");
  const main = document.getElementById("main-home");
  if (!container || !main) return;

  const engines = await getEngines();
  if (engines[RSS_NEWS_ENGINE_ID] === false) {
    if (!_isDesktop()) container.remove();
    return;
  }

  if (!_isDesktop()) {
    main.classList.add("has-feed");
    container.innerHTML = skeletonFeedCards();
    container.classList.add("home-news-feed--loading");
  }

  try {
    const items = await _fetchPage(1);
    if (items.length === 0) {
      if (!_isDesktop()) {
        main.classList.remove("has-feed");
        container.innerHTML = "";
        container.classList.remove("home-news-feed--loading");
      }
      return;
    }

    if (!_isDesktop()) container.classList.remove("home-news-feed--loading");
    container.innerHTML =
      items.map(_renderCard).join("") + `<div class="home-feed-sentinel"></div>`;
    feedPage = 2;

    const sentinel = container.querySelector<HTMLElement>(".home-feed-sentinel");
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void _loadMore(container);
      },
      { rootMargin: "400px" },
    );
    if (sentinel) observer.observe(sentinel);
  } catch {
    if (!_isDesktop()) {
      main.classList.remove("has-feed");
      container.innerHTML = "";
      container.classList.remove("home-news-feed--loading");
    }
  }
}
