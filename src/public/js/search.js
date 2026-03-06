import { state } from "./state.js";
import { MAX_PAGE } from "./constants.js";
import { showResults, setActiveTab } from "./navigation.js";
import { getEngines } from "./engines.js";
import { buildSearchUrl } from "./url.js";
import { destroyMediaObserver, closeMediaPreview } from "./media.js";
import {
  renderAtAGlance,
  renderResults,
  renderSidebar,
} from "./render.js";
import { hideAcDropdown } from "./autocomplete.js";

export async function performSearch(query, type, page) {
  if (!query.trim()) return;

  if (query.trim().startsWith("!")) {
    return performBangCommand(query, type, page || 1);
  }

  type = type || state.currentType || "all";
  state.currentQuery = query;
  state.currentType = type;
  state.currentPage = 1;
  state.lastPage = MAX_PAGE;
  state.imagePage = 1;
  state.imageLastPage = MAX_PAGE;
  state.videoPage = 1;
  state.videoLastPage = MAX_PAGE;
  destroyMediaObserver();

  const engines = await getEngines();
  const url = buildSearchUrl(query, engines, type, 1);

  showResults();
  setActiveTab(type);
  closeMediaPreview();
  hideAcDropdown(document.getElementById("ac-dropdown-home"));
  hideAcDropdown(document.getElementById("ac-dropdown-results"));
  document.getElementById("results-search-input").value = query;
  document.getElementById("results-meta").textContent = "Searching...";
  document.getElementById("at-a-glance").innerHTML = "";
  document.getElementById("results-list").innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  document.getElementById("pagination").innerHTML = "";
  document.getElementById("results-sidebar").innerHTML = "";
  document.title = `${query} - degoog`;

  const urlParams = new URLSearchParams({ q: query });
  if (type !== "all") urlParams.set("type", type);
  history.pushState(null, "", `/search?${urlParams.toString()}`);

  try {
    const res = await fetch(url);
    const data = await res.json();

    state.currentResults = data.results;
    state.currentData = data;

    document.getElementById("results-meta").textContent = `About ${data.results.length} results (${(data.totalTime / 1000).toFixed(2)} seconds)`;

    if (type === "all") {
      renderAtAGlance(data.atAGlance);
      renderSidebar(data, (q) => performSearch(q));
    } else {
      document.getElementById("at-a-glance").innerHTML = "";
      document.getElementById("results-sidebar").innerHTML = "";
    }
    renderResults(data.results);
  } catch (err) {
    document.getElementById("results-meta").textContent = "";
    document.getElementById("results-list").innerHTML = '<div class="no-results">Search failed. Please try again.</div>';
  }
}

async function performBangCommand(query, type, page = 1) {
  showResults();
  closeMediaPreview();
  hideAcDropdown(document.getElementById("ac-dropdown-home"));
  hideAcDropdown(document.getElementById("ac-dropdown-results"));
  document.getElementById("results-search-input").value = query;
  document.getElementById("results-meta").textContent = "Running command...";
  document.getElementById("at-a-glance").innerHTML = "";
  document.getElementById("results-list").innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  document.getElementById("pagination").innerHTML = "";
  document.getElementById("results-sidebar").innerHTML = "";
  document.title = `${query} - degoog`;

  state.currentBangQuery = query;

  const urlParams = new URLSearchParams({ q: query });
  if (page > 1) urlParams.set("page", String(page));
  history.pushState(null, "", `/search?${urlParams.toString()}`);

  try {
    const apiParams = new URLSearchParams({ q: query });
    if (page > 1) apiParams.set("page", String(page));
    const res = await fetch(`/api/command?${apiParams.toString()}`);
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    if (data.html === "__DETECT_CLIENT_IP__") {
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        return performBangCommand("!ip " + ipData.ip, type);
      } catch {
        document.getElementById("results-meta").textContent = "";
        document.getElementById("results-list").innerHTML = '<div class="no-results">Could not detect your public IP. Try: <strong>!ip 8.8.8.8</strong></div>';
        return;
      }
    }
    if (data.html === "__RUN_SPEEDTEST__") {
      document.getElementById("results-meta").textContent = "Speed Test";
      document.getElementById("results-list").innerHTML = renderSpeedtest();
      runSpeedtest();
      return;
    }
    if (data.type === "engine") {
      state.currentResults = data.results;
      state.currentData = data;
      document.getElementById("results-meta").textContent =
        `About ${data.results.length} results (${(data.totalTime / 1000).toFixed(2)} seconds)`;
      renderAtAGlance(data.atAGlance);
      renderResults(data.results);
      return;
    }
    document.getElementById("results-meta").textContent = data.title;
    document.getElementById("results-list").innerHTML = data.html;
    if (data.totalPages > 1) {
      renderBangPagination(data.totalPages, data.page, query);
    }
  } catch {
    document.getElementById("results-meta").textContent = "";
    document.getElementById("results-list").innerHTML = '<div class="no-results">Unknown command. Type <strong>!help</strong> for available commands.</div>';
  }
}

function renderSpeedtest() {
  return `<div class="command-result command-speedtest">
    <div class="speedtest-gauges">
      <div class="speedtest-gauge">
        <div class="speedtest-value" id="st-download">—</div>
        <div class="speedtest-label">Download (Mbps)</div>
        <div class="speedtest-bar"><div class="speedtest-bar-fill" id="st-download-bar"></div></div>
      </div>
      <div class="speedtest-gauge">
        <div class="speedtest-value" id="st-upload">—</div>
        <div class="speedtest-label">Upload (Mbps)</div>
        <div class="speedtest-bar"><div class="speedtest-bar-fill" id="st-upload-bar"></div></div>
      </div>
      <div class="speedtest-gauge">
        <div class="speedtest-value" id="st-latency">—</div>
        <div class="speedtest-label">Latency (ms)</div>
      </div>
    </div>
    <div class="speedtest-status" id="st-status">Starting...</div>
  </div>`;
}

async function runSpeedtest() {
  const status = document.getElementById("st-status");
  const dlEl = document.getElementById("st-download");
  const ulEl = document.getElementById("st-upload");
  const latEl = document.getElementById("st-latency");
  const dlBar = document.getElementById("st-download-bar");
  const ulBar = document.getElementById("st-upload-bar");
  const maxSpeed = 500;

  status.textContent = "Testing latency...";
  const pings = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    try {
      await fetch("/api/commands", { cache: "no-store" });
    } catch {}
    pings.push(performance.now() - t0);
  }
  const latency = Math.round(pings.sort((a, b) => a - b)[Math.floor(pings.length / 2)]);
  latEl.textContent = latency;

  status.textContent = "Testing download speed...";
  const dlUrl = "https://speed.cloudflare.com/__down?bytes=25000000";
  const dlStart = performance.now();
  try {
    const res = await fetch(dlUrl, { cache: "no-store" });
    const blob = await res.blob();
    const dlTime = (performance.now() - dlStart) / 1000;
    const dlMbps = ((blob.size * 8) / dlTime / 1e6).toFixed(1);
    dlEl.textContent = dlMbps;
    dlBar.style.width = Math.min((dlMbps / maxSpeed) * 100, 100) + "%";
  } catch {
    dlEl.textContent = "Error";
  }

  status.textContent = "Testing upload speed...";
  const ulData = new Uint8Array(5000000);
  const ulStart = performance.now();
  try {
    await fetch("https://speed.cloudflare.com/__up", { method: "POST", body: ulData, cache: "no-store" });
    const ulTime = (performance.now() - ulStart) / 1000;
    const ulMbps = ((ulData.byteLength * 8) / ulTime / 1e6).toFixed(1);
    ulEl.textContent = ulMbps;
    ulBar.style.width = Math.min((ulMbps / maxSpeed) * 100, 100) + "%";
  } catch {
    ulEl.textContent = "Error";
  }

  status.textContent = "Complete";
}

export async function goToPage(pageNum) {
  if (pageNum === state.currentPage) return;
  document.getElementById("results-list").innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  document.getElementById("pagination").innerHTML = "";
  const engines = await getEngines();
  const url = buildSearchUrl(state.currentQuery, engines, state.currentType, pageNum);
  try {
    const res = await fetch(url);
    const data = await res.json();
    state.currentResults = data.results;
    state.currentData = data;
    state.currentPage = pageNum;
    document.getElementById("results-meta").textContent = `About ${state.currentResults.length} results — Page ${state.currentPage}`;
    if (state.currentPage === 1 && data.atAGlance) {
      renderAtAGlance(data.atAGlance);
    }
    renderResults(state.currentResults);
    window.scrollTo(0, 0);
  } catch {
    document.getElementById("results-list").innerHTML = '<div class="no-results">Search failed. Please try again.</div>';
  }
}

export async function retryEngine(engineName) {
  if (!state.currentQuery || !state.currentData) return;

  const engines = await getEngines();
  const params = new URLSearchParams({ q: state.currentQuery, engine: engineName });
  for (const [key, val] of Object.entries(engines)) {
    params.set(key, String(val));
  }
  if (state.currentType && state.currentType !== "all") {
    params.set("type", state.currentType);
  }
  if (state.currentPage > 1) {
    params.set("page", String(state.currentPage));
  }
  if (state.currentTimeFilter && state.currentTimeFilter !== "any") {
    params.set("time", state.currentTimeFilter);
  }

  try {
    const res = await fetch(`/api/search/retry?${params.toString()}`);
    const data = await res.json();

    if (data.engineTimings) {
      state.currentData.engineTimings = data.engineTimings;
    }

    if (data.results && data.results.length > state.currentResults.length) {
      state.currentResults = data.results;
      state.currentData.results = data.results;
      if (data.atAGlance) state.currentData.atAGlance = data.atAGlance;

      document.getElementById("results-meta").textContent =
        `About ${data.results.length} results (${(state.currentData.totalTime / 1000).toFixed(2)} seconds)`;

      if (state.currentType === "all") {
        renderAtAGlance(state.currentData.atAGlance);
      }
      renderResults(data.results);
    }

    if (state.currentType === "all") {
      renderSidebar(state.currentData, (q) => performSearch(q));
    }
  } catch {}
}

function renderBangPagination(totalPages, activePage, query) {
  const container = document.getElementById("pagination");
  let html = '<div class="pagination"><div class="pagination-pages">';
  const maxVisible = 10;
  let startPage = Math.max(1, activePage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    if (i === activePage) {
      html += `<span class="pagination-current">${i}</span>`;
    } else {
      html += `<a class="pagination-link" data-page="${i}">${i}</a>`;
    }
  }
  html += '</div></div>';
  container.innerHTML = html;
  container.querySelectorAll("[data-page]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const pageNum = parseInt(el.dataset.page, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        performBangCommand(query, null, pageNum);
      }
    });
  });
}

export async function performLucky(query) {
  if (!query.trim()) return;
  const engines = await getEngines();
  const params = new URLSearchParams({ q: query });
  for (const [key, val] of Object.entries(engines)) {
    params.set(key, String(val));
  }
  window.location.href = `/api/lucky?${params.toString()}`;
}