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

export async function performSearch(query, type) {
  if (!query.trim()) return;

  if (query.trim().startsWith("!")) {
    return performBangCommand(query, type);
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

async function performBangCommand(query, type) {
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

  const urlParams = new URLSearchParams({ q: query });
  history.pushState(null, "", `/search?${urlParams.toString()}`);

  try {
    const res = await fetch(`/api/command?q=${encodeURIComponent(query)}`);
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
    document.getElementById("results-meta").textContent = data.title;
    document.getElementById("results-list").innerHTML = data.html;
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

export async function performLucky(query) {
  if (!query.trim()) return;
  const engines = await getEngines();
  const params = new URLSearchParams({ q: query });
  for (const [key, val] of Object.entries(engines)) {
    params.set(key, String(val));
  }
  window.location.href = `/api/lucky?${params.toString()}`;
}