# Custom plugins (commands and slots)

Plugins live in `data/plugins/` (or `DEGOOG_PLUGINS_DIR`). Each plugin is a **folder** containing an entry point and optional asset files.

---

## Plugin folder structure

```
data/plugins/
  my-plugin/
    index.js        # entry point (required)
    template.html   # HTML template (optional)
    style.css       # scoped CSS (optional)
    script.js       # client-side JavaScript (optional)
```

The entry point must be named `index.{js,ts,mjs,cjs}`. A single folder can export a **BangCommand**, a **SlotPlugin**, or both.

### Asset files

- **`template.html`** — An HTML fragment used by your plugin to render output. Use `{{placeholders}}` for dynamic values and replace them in your `execute()` function. This is not a full HTML page; it gets injected into the search results.
- **`style.css`** — CSS styles for your plugin. Automatically loaded and served to the browser when your plugin is active. Use class names scoped to your plugin to avoid conflicts.
- **`script.js`** — Client-side JavaScript. Automatically loaded and served to the browser.
- You can add any additional files to the folder and read them at runtime using the `readFile` helper from the plugin context.

### Plugin context and `init()`

When a plugin folder contains a `template.html`, `style.css`, or `script.js`, the system reads them automatically and passes them to your plugin via the optional `init(context)` method:

```js
init(ctx) {
  // ctx.template  — contents of template.html (empty string if not present)
  // ctx.dir       — absolute path to the plugin folder
  // ctx.readFile  — async helper: ctx.readFile("my-data.json") reads a file from the plugin folder
}
```

`init()` is called once at startup, before `configure()`.

---

## Bang command plugins

Each plugin folder exports a **BangCommand** object with:

- **`name`** (string) — display name shown in Settings and `!help`
- **`description`** (string) — short description shown in `!help`
- **`trigger`** (string) — the word after `!` that activates the command
- **`execute(args, context?)`** (async function) — returns `Promise<CommandResult>`

**Optional properties:**

- **`aliases`** (string[]) — additional triggers for the same command
- **`settingsSchema`** (SettingField[]) — declares configurable fields; they appear as a card in Settings → Plugins with a Configure modal
- **`configure(settings)`** (function) — called on startup (if settings exist) and whenever settings are saved in the UI; use it to load config values into local variables
- **`isConfigured()`** (async function) — return `false` to hide the command from `!help` until required settings are filled in
- **`init(context)`** (function) — called once at startup with the plugin context (template, dir, readFile)

---

**CommandResult** shape:

```js
{ title: string, html: string, totalPages?: number }
```

**CommandContext** shape:

```js
{ clientIp?: string, page?: number }
```

---

**SettingField** shape:

```js
{
  key: string,
  label: string,
  type: "text" | "password" | "url" | "toggle",
  required?: boolean,
  placeholder?: string,
  description?: string,
  secret?: boolean, // value is never sent to the browser; stored server-side only
}
```

---

## Setup

Create a `./data/plugins` folder at the project root, or set `DEGOOG_PLUGINS_DIR` to load from a different directory.

Each plugin is a subfolder with an `index.{js,ts,mjs,cjs}` entry point.

The plugin id is derived from the folder name with a `plugin-` prefix (e.g. `weather/index.js` → id `plugin-weather`).

## How settings work

1. Declare `settingsSchema` on your plugin — this makes a Configure button appear in Settings → Plugins.
2. The user fills in and saves the form. The values are stored in `data/plugin-settings.json` server-side.
3. `configure(settings)` is called immediately after save, and also on every server restart if settings already exist.
4. Implement `isConfigured()` to return `false` when required settings are missing — this hides the command from `!help` until it is ready.
5. Users can fully disable any custom plugin using the toggle switch in Settings → Plugins. Disabled plugins are hidden from `!help` and return an error when invoked. The disabled state is stored as `"disabled": "true"` in `plugin-settings.json`.

See [the official weather plugin](https://github.com/fccview/fccview-degoog-extensions/tree/main/plugins/weather) for a fully working drop-in weather plugin with separate template and styles.

Bang commands appear in Settings with type **command**.

---

## Slot plugins

Slot plugins inject panels into the search results page when the query matches. They are **stackable**: if multiple slot plugins match, all their panels are shown. Export a **slot** (or **slotPlugin**) from the same module that may export a BangCommand:

- **`id`** (string) — unique id for the slot
- **`name`** (string) — display name
- **`position`** — `"above-results"` | `"below-results"` | `"sidebar"` (where the panel is rendered)
- **`trigger(query)`** (function) — return true if the slot should show for this query (e.g. keyword or regex match)
- **`execute(query, context?)`** (async function) — returns `Promise<{ title?: string, html: string }>` (panel content)

Optional: **`settingsSchema`**, **`configure(settings)`**, **`init(context)`** (settings stored under `slot-<id>` in plugin-settings).

See [data/plugins/imdb-slot/](../../data/plugins/imdb-slot/) for a fully working slot plugin with separate template and styles.

Slot panels are rendered in three positions: above the results list, below the results list, and in the results sidebar. All positions are available by default.

Slot plugins with a settings schema can be disabled via the toggle in Settings → Plugins, just like bang command plugins.

---

## Example: minimal plugin with template

```
data/plugins/greeting/
  index.js
  template.html
  style.css
```

**index.js**
```js
let template = "";

export default {
  name: "Greeting",
  description: "Say hello",
  trigger: "hello",

  init(ctx) {
    template = ctx.template;
  },

  async execute(args) {
    const name = args.trim() || "world";
    const html = template.replace("{{name}}", name);
    return { title: "Hello", html };
  },
};
```

**template.html**
```html
<div class="command-result greeting">
  <h3 class="greeting-title">Hello, {{name}}!</h3>
</div>
```

**style.css**
```css
.greeting-title {
  color: var(--text-primary);
  font-size: 1.5rem;
}
```
