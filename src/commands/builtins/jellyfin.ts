import type { BangCommand, CommandResult } from "../../types";

const JELLYFIN_URL = process.env.DEGOOG_JELLYFIN_URL || "";
const JELLYFIN_API_KEY = process.env.DEGOOG_JELLYFIN_API_KEY || "";

export const jellyfinCommand: BangCommand = {
  name: "Jellyfin",
  description: "Search your Jellyfin media library",
  trigger: "jellyfin",
  async execute(args: string): Promise<CommandResult> {
    if (!args.trim()) {
      return {
        title: "Jellyfin Search",
        html: `<div class="command-result"><p>Usage: <code>!jellyfin &lt;search term&gt;</code></p></div>`,
      };
    }
    try {
      const term = args.trim();
      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const [hintsRes, peopleRes] = await Promise.all([
        fetch(`${JELLYFIN_URL}/Search/Hints?searchTerm=${encodeURIComponent(term)}&api_key=${JELLYFIN_API_KEY}&Limit=25&IncludeItemTypes=Movie,Series,Episode,Audio,MusicAlbum,MusicArtist`),
        fetch(`${JELLYFIN_URL}/Persons?searchTerm=${encodeURIComponent(term)}&api_key=${JELLYFIN_API_KEY}&Limit=5&Fields=Overview,PrimaryImageAspectRatio`),
      ]);
      const hintsData = await hintsRes.json();
      const peopleData = await peopleRes.json();

      const people = (peopleData.Items || []) as any[];
      const personIds = people.map((p: any) => p.Id);

      let personItems: any[] = [];
      if (personIds.length > 0) {
        const personItemsRes = await fetch(
          `${JELLYFIN_URL}/Items?PersonIds=${personIds.join(",")}&api_key=${JELLYFIN_API_KEY}&Recursive=true&Limit=30&Fields=Overview,People&IncludeItemTypes=Movie,Series`,
        );
        const personItemsData = await personItemsRes.json();
        personItems = personItemsData.Items || [];
      }

      const seen = new Set<string>();
      const allItems: any[] = [];

      for (const hint of hintsData.SearchHints || []) {
        if (!seen.has(hint.ItemId)) {
          seen.add(hint.ItemId);
          allItems.push({
            Id: hint.ItemId,
            Name: hint.Name,
            Type: hint.Type,
            ProductionYear: hint.ProductionYear,
            Overview: hint.Overview || "",
            ImageTags: hint.PrimaryImageTag ? { Primary: hint.PrimaryImageTag } : {},
            MatchedFrom: "search",
          });
        }
      }

      for (const item of personItems) {
        if (!seen.has(item.Id)) {
          seen.add(item.Id);
          const matchedPeople = (item.People || [])
            .filter((p: any) => p.Name?.toLowerCase().includes(term.toLowerCase()))
            .map((p: any) => `${p.Name} (${p.Type || p.Role || "Cast"})`)
            .slice(0, 3);
          allItems.push({
            ...item,
            MatchedFrom: "person",
            MatchedPeople: matchedPeople,
          });
        }
      }

      if (allItems.length === 0) {
        return {
          title: "Jellyfin Search",
          html: `<div class="command-result"><p>No results found for "${escHtml(term)}"</p></div>`,
        };
      }

      const results = allItems
        .map((item: any) => {
          const name = escHtml(item.Name || "");
          const overview = escHtml(item.Overview || "");
          const year = item.ProductionYear ? ` (${item.ProductionYear})` : "";
          const typeBadge = `<span class="result-engine-tag">${escHtml(item.Type)}</span>`;
          const jellyfinTag = `<span class="result-engine-tag">Jellyfin</span>`;
          const personInfo = item.MatchedPeople?.length
            ? `<span class="result-engine-tag">${escHtml(item.MatchedPeople.join(", "))}</span>`
            : "";
          const itemUrl = `${JELLYFIN_URL}/web/index.html#!/details?id=${item.Id}`;
          const thumbnail = item.ImageTags?.Primary
            ? `<img class="result-favicon" src="${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=52&api_key=${JELLYFIN_API_KEY}" alt="">`
            : `<img class="result-favicon" src="" alt="">`;
          return `<div class="result-item"><div class="result-url-row">${thumbnail}<cite class="result-cite">${escHtml(JELLYFIN_URL)}</cite></div><a class="result-title" href="${escHtml(itemUrl)}" target="_blank">${name}${year}</a><p class="result-snippet">${overview}</p><div class="result-engines">${typeBadge}${jellyfinTag}${personInfo}</div></div>`;
        })
        .join("");
      return {
        title: `Jellyfin: ${term} — ${allItems.length} results`,
        html: `<div class="command-result">${results}</div>`,
      };
    } catch {
      return {
        title: "Jellyfin Search",
        html: `<div class="command-result"><p>Failed to connect to Jellyfin. Check your configuration.</p></div>`,
      };
    }
  },
};
