import { escapeHtml } from "../utils/dom";
import type { SlotPanel } from "../types";

const SLOT_IDS = ["slot-above-results", "slot-below-results", "slot-sidebar"];

export function clearSlotPanels(): void {
  for (const id of SLOT_IDS) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  }
  const glanceEl = document.getElementById("at-a-glance");
  if (glanceEl) glanceEl.innerHTML = "";
}

function _renderSlotPanelsInto(panels: SlotPanel[], clearFirst: boolean): void {
  if (!panels || !Array.isArray(panels) || panels.length === 0) return;
  if (clearFirst) clearSlotPanels();
  const byPosition: Record<string, HTMLElement | null> = {
    "above-results": document.getElementById("slot-above-results"),
    "below-results": document.getElementById("slot-below-results"),
    sidebar: document.getElementById("slot-sidebar"),
    "at-a-glance": document.getElementById("at-a-glance"),
  };
  for (const panel of panels) {
    const container = byPosition[panel.position];
    if (!container) continue;
    if (panel.position === "at-a-glance") {
      container.innerHTML = panel.html;
    } else {
      const block = document.createElement("div");
      block.className = "results-slot-panel";
      if (panel.title) {
        const titleEl = document.createElement("div");
        titleEl.className = "results-slot-panel-title";
        titleEl.textContent = panel.title;
        block.appendChild(titleEl);
      }
      const body = document.createElement("div");
      body.className = "results-slot-panel-body";
      body.innerHTML = panel.html;
      block.appendChild(body);
      container.appendChild(block);
    }
  }
}

export function renderSlotPanels(panels: SlotPanel[]): void {
  _renderSlotPanelsInto(panels, true);
}

export function appendSlotPanels(panels: SlotPanel[]): void {
  _renderSlotPanelsInto(panels, false);
}

export function renderAtAGlance(data: {
  snippet: string;
  url: string;
  title: string;
  sources: string[];
} | null): void {
  const container = document.getElementById("at-a-glance");
  if (!container) return;
  if (!data) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div class="glance-box">
      <div class="glance-snippet">${escapeHtml(data.snippet)}</div>
      <a class="glance-link" href="${escapeHtml(data.url)}" target="_blank">${escapeHtml(data.title)}</a>
      <div class="glance-sources">Found on: ${data.sources.map((s) => `<span class="glance-source">${escapeHtml(s)}</span>`).join(", ")}</div>
    </div>
  `;
}
