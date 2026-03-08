const overlay = document.getElementById("ext-modal-overlay");
const modal = document.getElementById("ext-modal");
const titleEl = document.getElementById("ext-modal-title");
const bodyEl = document.getElementById("ext-modal-body");
const saveBtn = document.getElementById("ext-modal-save");
const closeBtn = document.getElementById("ext-modal-close");
const statusEl = document.getElementById("ext-modal-status");

let currentExt = null;

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function parseUrlListValue(raw, defaultUrls) {
  const emptyDefaults = defaultUrls ?? [];
  if (Array.isArray(raw)) {
    const valid = raw.filter((u) => typeof u === "string" && u.startsWith("http"));
    return valid;
  }
  if (!raw || String(raw).trim() === "") return emptyDefaults;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return emptyDefaults;
    const valid = parsed.filter((u) => typeof u === "string" && u.startsWith("http"));
    return valid;
  } catch {
    return emptyDefaults;
  }
}

function renderRssUrlListField(field, ext) {
  const defaultUrls = ext.defaultFeedUrls ?? [];
  const urls = parseUrlListValue(ext.settings[field.key], defaultUrls);
  const descHtml = field.description
    ? `<p class="ext-field-desc">${escapeHtml(field.description)}</p>`
    : "";
  const listItems = urls
    .map(
      (url) =>
        `<li class="ext-field-urllist-item" data-url="${escapeHtml(url)}">
          <span class="ext-field-urllist-url">${escapeHtml(url)}</span>
          <button type="button" class="ext-field-urllist-remove" aria-label="Remove">×</button>
        </li>`,
    )
    .join("");
  return `
    <div class="ext-field" data-key="${escapeHtml(field.key)}" data-type="urllist">
      <label class="ext-field-label">${escapeHtml(field.label)}</label>
      <ul class="ext-field-urllist">${listItems}</ul>
      <div class="ext-field-urllist-add">
        <input type="url" class="ext-field-input ext-field-urllist-input" placeholder="${escapeHtml(field.placeholder || "https://example.com/feed.xml")}" autocomplete="off">
        <button type="button" class="ext-field-urllist-add-btn">Add</button>
      </div>
      <input type="hidden" id="field-${escapeHtml(field.key)}" class="ext-field-urllist-value">
      ${descHtml}
    </div>`;
}

function initRssUrlList(container) {
  const field = container.querySelector(".ext-field[data-type='urllist']");
  if (!field) return;
  const listEl = field.querySelector(".ext-field-urllist");
  const addInput = field.querySelector(".ext-field-urllist-input");
  const addBtn = field.querySelector(".ext-field-urllist-add-btn");
  const hiddenInput = field.querySelector(".ext-field-urllist-value");
  if (!listEl || !addInput || !addBtn || !hiddenInput) return;

  const initialUrls = [...listEl.querySelectorAll(".ext-field-urllist-item")].map(
    (li) => li.dataset.url || "",
  ).filter(Boolean);
  hiddenInput.value = JSON.stringify(initialUrls);

  function getUrls() {
    try {
      const parsed = JSON.parse(hiddenInput.value || "[]");
      return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
    } catch {
      return [];
    }
  }

  function setUrls(urls) {
    hiddenInput.value = JSON.stringify(urls);
  }

  function addUrl(url) {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) return;
    try {
      new URL(trimmed);
    } catch {
      return;
    }
    const urls = getUrls();
    if (urls.includes(trimmed)) return;
    urls.push(trimmed);
    setUrls(urls);
    const li = document.createElement("li");
    li.className = "ext-field-urllist-item";
    li.dataset.url = trimmed;
    li.innerHTML = `<span class="ext-field-urllist-url">${escapeHtml(trimmed)}</span><button type="button" class="ext-field-urllist-remove" aria-label="Remove">×</button>`;
    li.querySelector(".ext-field-urllist-remove").addEventListener("click", () => {
      const u = getUrls().filter((x) => x !== trimmed);
      setUrls(u);
      li.remove();
    });
    listEl.appendChild(li);
  }

  field.querySelectorAll(".ext-field-urllist-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const li = btn.closest(".ext-field-urllist-item");
      const url = li?.dataset?.url;
      if (!url) return;
      const urls = getUrls().filter((u) => u !== url);
      setUrls(urls);
      li.remove();
    });
  });

  addBtn.addEventListener("click", () => {
    const val = addInput.value;
    if (val) {
      addUrl(val);
      addInput.value = "";
    }
  });
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = addInput.value;
      if (val) {
        addUrl(val);
        addInput.value = "";
      }
    }
  });
}

function renderField(field, currentValue, ext) {
  const isSecret = field.secret === true;
  const isSet = currentValue === "__SET__";
  const displayValue = isSecret ? "" : (currentValue || "");
  const configuredClass = isSecret && isSet ? " ext-field-input--configured" : "";
  const placeholder = isSecret && isSet
    ? "••••••••"
    : (field.placeholder || "");

  const descHtml = field.description
    ? `<p class="ext-field-desc">${escapeHtml(field.description)}</p>`
    : "";

  if (ext?.id === "rss-news" && field.key === "urls") {
    return renderRssUrlListField(field, ext);
  }

  if (field.type === "toggle") {
    const checked = currentValue === "true" ? "checked" : "";
    return `
      <div class="ext-field" data-key="${escapeHtml(field.key)}" data-type="toggle">
        <label class="ext-field-toggle-row">
          <span class="ext-field-label">${escapeHtml(field.label)}</span>
          <label class="engine-toggle">
            <input type="checkbox" id="field-${escapeHtml(field.key)}" ${checked}>
            <span class="toggle-slider"></span>
          </label>
        </label>
        ${descHtml}
      </div>`;
  }

  if (field.type === "textarea") {
    return `
      <div class="ext-field" data-key="${escapeHtml(field.key)}" data-type="textarea" data-secret="${isSecret}" data-was-set="${isSet}">
        <label class="ext-field-label" for="field-${escapeHtml(field.key)}">${escapeHtml(field.label)}${field.required ? " <span class='ext-required'>*</span>" : ""}</label>
        <textarea
          class="ext-field-input ext-field-textarea${configuredClass}"
          id="field-${escapeHtml(field.key)}"
          placeholder="${escapeHtml(placeholder)}"
          rows="6"
          autocomplete="off"
        >${escapeHtml(displayValue)}</textarea>
        ${descHtml}
      </div>`;
  }

  if (field.type === "select" && Array.isArray(field.options) && field.options.length > 0) {
    const validValue = field.options.includes(currentValue) ? currentValue : field.options[0];
    const opts = field.options
      .map((v) => `<option value="${escapeHtml(v)}"${validValue === v ? " selected" : ""}>${escapeHtml(v.charAt(0).toUpperCase() + v.slice(1))}</option>`)
      .join("");
    return `
      <div class="ext-field" data-key="${escapeHtml(field.key)}" data-type="select">
        <label class="ext-field-label" for="field-${escapeHtml(field.key)}">${escapeHtml(field.label)}</label>
        <select id="field-${escapeHtml(field.key)}" class="ext-field-input ext-field-select">
          ${opts}
        </select>
        ${descHtml}
      </div>`;
  }

  const inputType = field.type === "password" ? "password" : (field.type === "url" ? "url" : "text");
  return `
    <div class="ext-field" data-key="${escapeHtml(field.key)}" data-type="${escapeHtml(field.type)}" data-secret="${isSecret}" data-was-set="${isSet}">
      <label class="ext-field-label" for="field-${escapeHtml(field.key)}">${escapeHtml(field.label)}${field.required ? " <span class='ext-required'>*</span>" : ""}</label>
      <input
        class="ext-field-input${configuredClass}"
        type="${inputType}"
        id="field-${escapeHtml(field.key)}"
        value="${escapeHtml(displayValue)}"
        placeholder="${escapeHtml(placeholder)}"
        autocomplete="off"
      >
      ${descHtml}
    </div>`;
}

function collectValues() {
  const values = {};
  bodyEl.querySelectorAll(".ext-field").forEach((fieldEl) => {
    const key = fieldEl.dataset.key;
    const type = fieldEl.dataset.type;
    const isSecret = fieldEl.dataset.secret === "true";
    const wasSet = fieldEl.dataset.wasSet === "true";

    if (type === "toggle") {
      const input = fieldEl.querySelector("input[type=checkbox]");
      values[key] = input.checked ? "true" : "false";
      return;
    }

    if (type === "select") {
      const select = fieldEl.querySelector("select");
      values[key] = select ? select.value : "";
      return;
    }

    if (type === "urllist") {
      const hidden = fieldEl.querySelector(".ext-field-urllist-value");
      try {
        const parsed = hidden?.value ? JSON.parse(hidden.value) : [];
        values[key] = Array.isArray(parsed) ? parsed : [];
      } catch {
        values[key] = [];
      }
      return;
    }

    const input = fieldEl.querySelector("textarea") || fieldEl.querySelector("input");
    const val = input.value.trim();

    if (isSecret) {
      if (val === "" && wasSet) return;
      values[key] = val;
    } else {
      values[key] = val;
    }
  });
  return values;
}

export function openModal(ext) {
  currentExt = ext;
  titleEl.textContent = `Configure ${ext.displayName}`;
  statusEl.textContent = "";

  bodyEl.innerHTML = ext.settingsSchema
    .map((field) => renderField(field, ext.settings[field.key] ?? "", ext))
    .join("");

  initRssUrlList(bodyEl);

  bodyEl.querySelectorAll(".ext-field-input--configured").forEach((input) => {
    input.addEventListener("focus", () => input.classList.remove("ext-field-input--configured"), { once: true });
  });

  overlay.style.display = "flex";
  const firstFocusable = bodyEl.querySelector("select, input, textarea");
  if (firstFocusable) firstFocusable.focus();
}

export function closeModal() {
  overlay.style.display = "none";
  currentExt = null;
  statusEl.textContent = "";
}

async function save() {
  if (!currentExt) return;
  const values = collectValues();
  saveBtn.disabled = true;
  statusEl.textContent = "Saving…";
  try {
    const res = await fetch(`/api/extensions/${encodeURIComponent(currentExt.id)}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error("Failed");
    statusEl.textContent = "Saved";
    window.dispatchEvent(new CustomEvent("extensions-saved"));
    setTimeout(closeModal, 800);
  } catch {
    statusEl.textContent = "Save failed. Please try again.";
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener("click", save);
closeBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
