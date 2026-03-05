import { escapeHtml } from "./utils.js";

let acController = null;
let acTimeout = null;
let acSelectedIdx = -1;

export function updateAcHighlight(items) {
  items.forEach((el, i) => {
    el.classList.toggle("ac-active", i === acSelectedIdx);
  });
}

export function hideAcDropdown(dropdown) {
  dropdown.style.display = "none";
  dropdown.parentElement.classList.remove("ac-open");
  acSelectedIdx = -1;
}

export async function fetchSuggestions(query, input, dropdown, performSearch) {
  if (acController) acController.abort();
  acController = new AbortController();

  try {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal: acController.signal });
    const suggestions = await res.json();

    if (!suggestions.length || input.value.trim() !== query) {
      dropdown.innerHTML = "";
      dropdown.style.display = "none";
      return;
    }

    acSelectedIdx = -1;
    dropdown.innerHTML = suggestions
      .map((s) => `<div class="ac-item">${escapeHtml(s)}</div>`)
      .join("");
    dropdown.style.display = "block";
    dropdown.parentElement.classList.add("ac-open");

    dropdown.querySelectorAll(".ac-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = el.textContent;
        hideAcDropdown(dropdown);
        performSearch(el.textContent);
      });
    });
  } catch { }
}

export function initAutocomplete(input, dropdown, performSearch) {
  input.addEventListener("input", () => {
    clearTimeout(acTimeout);
    const q = input.value.trim();
    if (!q || q.startsWith("!")) {
      dropdown.innerHTML = "";
      dropdown.style.display = "none";
      dropdown.parentElement.classList.remove("ac-open");
      return;
    }
    acTimeout = setTimeout(() => fetchSuggestions(q, input, dropdown, performSearch), 150);
  });

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".ac-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      acSelectedIdx = Math.min(acSelectedIdx + 1, items.length - 1);
      updateAcHighlight(items);
      input.value = items[acSelectedIdx].textContent;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      acSelectedIdx = Math.max(acSelectedIdx - 1, 0);
      updateAcHighlight(items);
      input.value = items[acSelectedIdx].textContent;
    } else if (e.key === "Enter") {
      hideAcDropdown(dropdown);
    } else if (e.key === "Escape") {
      hideAcDropdown(dropdown);
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => hideAcDropdown(dropdown), 150);
  });

  input.addEventListener("focus", () => {
    if (dropdown.children.length > 0) {
      dropdown.style.display = "block";
      dropdown.parentElement.classList.add("ac-open");
    }
  });
}
