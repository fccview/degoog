import { escapeHtml } from "../utils/dom";
import { renderAtAGlance, appendSlotPanels } from "./render-slots";
import { skeletonGlance } from "./skeleton";
import type { ScoredResult, SlotPanel } from "../types";

let glanceAbortController: AbortController | null = null;

export async function fetchGlancePanels(
  query: string,
  results: ScoredResult[],
  fallbackAtAGlance: ScoredResult | null,
): Promise<void> {
  if (glanceAbortController) glanceAbortController.abort();
  glanceAbortController = new AbortController();
  const signal = glanceAbortController.signal;
  const glanceEl = document.getElementById("at-a-glance");
  if (!results || results.length === 0) {
    if (glanceEl && fallbackAtAGlance) renderAtAGlance(fallbackAtAGlance);
    return;
  }
  if (glanceEl) glanceEl.innerHTML = skeletonGlance();
  try {
    const res = await fetch("/api/slots/glance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), results }),
      signal,
    });
    if (signal.aborted) return;
    const data = (await res.json()) as { panels?: SlotPanel[] };
    if (signal.aborted) return;
    if (!glanceEl) return;
    if (data.panels && data.panels.length > 0) {
      for (const panel of data.panels) {
        if (panel.position === "at-a-glance") glanceEl.innerHTML = panel.html;
      }
    } else if (fallbackAtAGlance) {
      renderAtAGlance(fallbackAtAGlance);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    if (glanceEl && fallbackAtAGlance) renderAtAGlance(fallbackAtAGlance);
  }
}

export async function fetchSlotPanels(query: string): Promise<void> {
  try {
    const res = await fetch("/api/slots?q=" + encodeURIComponent(query));
    if (!res.ok) return;
    const data = (await res.json()) as { panels?: SlotPanel[] };
    if (data.panels && data.panels.length > 0) {
      appendSlotPanels(data.panels);
    }
  } catch {}
}

export const buildCommandGlanceHtml = (cmdData: {
  type: string;
  results?: ScoredResult[];
  atAGlance?: { snippet: string } | null;
}): string => {
  if (cmdData.type === "engine" && cmdData.results && cmdData.results.length > 0) {
    const glance =
      cmdData.atAGlance && cmdData.atAGlance.snippet
        ? `<div class="glance-box"><div class="glance-snippet">${escapeHtml(cmdData.atAGlance.snippet)}</div></div>`
        : "";
    return `<div class="command-result">${glance}<p class="natural-command-meta">${cmdData.results.length} results from engine</p></div>`;
  }
  if (cmdData.type === "engine") {
    return `<div class="command-result"><p class="natural-command-meta">${cmdData.results?.length ?? 0} results from engine</p></div>`;
  }
  return "";
};
