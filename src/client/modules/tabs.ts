import { state } from "../state";
import { performSearch } from "./search";

export function initTabs(): void {
  document.querySelectorAll<HTMLElement>(".results-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const type = tab.dataset.type;
      if (state.currentQuery && type) {
        void performSearch(state.currentQuery, type);
      }
    });
  });
}
