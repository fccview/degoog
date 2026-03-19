import { state } from "../state";
import { performSearch } from "./search-actions";

const TIME_LABELS: Record<string, string> = {
  any: "Any time",
  hour: "Hour",
  day: "24 hours",
  week: "Week",
  month: "Month",
  year: "Year",
};

export function initTimeFilter(): void {
  const toggle = document.getElementById("tools-toggle");
  const dropdown = document.getElementById("tools-dropdown");
  const toolsBar = document.getElementById("tools-bar");
  if (!toggle || !dropdown || !toolsBar) return;

  function setToggleLabel(): void {
    if (!toggle) return;
    toggle.textContent =
      TIME_LABELS[state.currentTimeFilter] || TIME_LABELS.any;
    toggle.classList.toggle("active", state.currentTimeFilter !== "any");
  }

  function closeToolsDropdown(): void {
    if (!dropdown || !toggle) return;
    dropdown.style.display = "none";
    if (dropdown.parentElement === document.body) {
      dropdown.style.top = "";
      dropdown.style.left = "";
      dropdown.style.position = "";
      toolsBar?.appendChild(dropdown);
    }
    toggle.classList.toggle("active", state.currentTimeFilter !== "any");
  }

  function openToolsDropdown(): void {
    if (!toggle || !dropdown) return;
    const rect = toggle.getBoundingClientRect();
    document.body.appendChild(dropdown);
    dropdown.style.position = "absolute";
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX - rect.width}px`;
    dropdown.style.display = "block";
    toggle.classList.add("active");
  }

  setToggleLabel();

  toggle.addEventListener("click", () => {
    const open = dropdown.style.display !== "none";
    if (open) {
      closeToolsDropdown();
    } else {
      openToolsDropdown();
    }
  });

  document.addEventListener("click", (e) => {
    const target = e.target as Node;
    if (!toolsBar.contains(target) && !dropdown.contains(target)) {
      closeToolsDropdown();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      if (dropdown.style.display === "block") closeToolsDropdown();
    },
    { capture: true },
  );

  dropdown.addEventListener("click", (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLElement>(".tools-option");
    if (!opt) return;
    const value = opt.dataset.time;
    if (!value || value === state.currentTimeFilter) return;
    state.currentTimeFilter = value;
    dropdown.querySelectorAll<HTMLElement>(".tools-option").forEach((o) => {
      o.classList.toggle("active", o.dataset.time === value);
    });
    closeToolsDropdown();
    setToggleLabel();
    if (state.currentQuery)
      void performSearch(state.currentQuery, state.currentType);
  });
}
