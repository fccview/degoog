import { idbGet, idbSet } from "../utils/db";
import { SETTINGS_KEY } from "../constants";
import { escapeHtml, isConfigured } from "../utils/dom";
import { openModal } from "../modules/modal/modal";
import type { ExtensionMeta, EngineRecord, AllExtensions } from "../types";

const SEARCH_TYPE_LABELS: Record<string, string> = {
  web: "Web",
  images: "Images",
  videos: "Videos",
  news: "News",
};

const _groupByType = (engines: ExtensionMeta[]): Record<string, ExtensionMeta[]> => {
  const groups: Record<string, ExtensionMeta[]> = {};
  for (const engine of engines) {
    const type = engine.description.split(" ")[0].toLowerCase();
    const label = SEARCH_TYPE_LABELS[type] || "Other";
    if (!groups[label]) groups[label] = [];
    groups[label].push(engine);
  }
  return groups;
};

const _renderEngineCard = (engine: ExtensionMeta, enabledMap: EngineRecord): string => {
  const isEnabled = enabledMap[engine.id] !== false;
  const configured = engine.configurable && isConfigured(engine);
  const badge = configured ? `<span class="ext-configured-badge"></span>` : "";
  const configureBtn = engine.configurable
    ? `<button class="ext-card-configure" data-id="${escapeHtml(engine.id)}" type="button">Configure</button>`
    : "";
  return `
    <div class="ext-card" data-id="${escapeHtml(engine.id)}">
      <div class="ext-card-main">
        <div class="ext-card-info">
          <span class="ext-card-name">${escapeHtml(engine.displayName)}</span>
        </div>
        <div class="ext-card-actions">
          ${badge}
          ${configureBtn}
          <label class="engine-toggle">
            <input type="checkbox" class="engine-toggle-input" data-id="${escapeHtml(engine.id)}" ${isEnabled ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>`;
};

export async function initEnginesTab(allExtensions: AllExtensions): Promise<void> {
  const container = document.getElementById("engines-content");
  if (!container) return;

  const savedEngines = await idbGet<EngineRecord>(SETTINGS_KEY);
  const savedEnginesMap = savedEngines || {};
  const defaultsFromEngines = Object.fromEntries(
    allExtensions.engines.map((e) => [e.id, e.defaultEnabled !== false]),
  );
  const enabledMap: EngineRecord = { ...defaultsFromEngines, ...savedEnginesMap };

  const groups = _groupByType(allExtensions.engines);
  let html = "";
  for (const [label, engines] of Object.entries(groups)) {
    html += `<div class="ext-group"><h3 class="ext-group-label">${escapeHtml(label)}</h3><div class="ext-cards">`;
    for (const engine of engines) {
      html += _renderEngineCard(engine, enabledMap);
    }
    html += `</div></div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll<HTMLInputElement>(".engine-toggle-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const id = input.dataset.id;
      if (id) enabledMap[id] = input.checked;
      await idbSet(SETTINGS_KEY, enabledMap);
    });
  });

  container.querySelectorAll<HTMLElement>(".ext-card-configure").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const ext = allExtensions.engines.find((e) => e.id === id);
      if (ext) openModal(ext);
    });
  });
}
