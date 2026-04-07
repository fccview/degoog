import {
  SlotPanelPosition,
  TranslateFunction,
  type SlotPlugin,
} from "../../../../types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const atAGlanceSlot: SlotPlugin = {
  id: "at-a-glance",
  name: "At a Glance",
  get description(): string {
    return this.t!("at-a-glance.description");
  },
  position: SlotPanelPosition.AtAGlance,
  waitForResults: true,

  t: TranslateFunction,

  trigger(): boolean {
    return true;
  },

  async execute(_query: string, context): Promise<{ html: string }> {
    const results = context?.results ?? [];
    const top = results.length > 0 && results[0].snippet ? results[0] : null;
    if (!top) return { html: "" };

    const foundOn = this.t!("at-a-glance.found-on", {
      sources_text: top.sources.join(", "),
    });

    return {
      html:
        '<div class="glance-box">' +
        `<div class="glance-snippet">${escapeHtml(top.snippet)}</div>` +
        `<a class="glance-link" href="${escapeHtml(top.url)}" target="_blank">${escapeHtml(top.title)}</a>` +
        `<div class="glance-sources">${escapeHtml(foundOn)}</div>` +
        "</div>",
    };
  },
};

export const slot = atAGlanceSlot;
