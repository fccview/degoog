# Environment Variables

<details>
<summary><strong>General</strong></summary>

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `4444` |

</details>

<details>
<summary><strong>Search Engines</strong></summary>

| Variable | Description | Default |
|---|---|---|
| `DEGOOG_BRAVE_API_KEY` | Brave Search API subscription token. Enables Brave as a search engine when set. | _(disabled)_ |

</details>

<details>
<summary><strong>Plugins</strong></summary>

| Variable | Description | Default |
|---|---|---|
| `DEGOOG_PLUGINS_DIR` | Directory to load custom search engine plugins from | `data/plugins` |
| `DEGOOG_COMMANDS_DIR` | Directory to load custom bang command plugins from | `data/commands` |
| `DEGOOG_ALIASES_FILE` | Path to a JSON file defining custom bang command aliases | `data/aliases.json` |

</details>

<details>
<summary><strong>Jellyfin (!jellyfin / !jf)</strong></summary>

Enables the `!jellyfin <query>` (alias: `!jf`) bang command to search your Jellyfin media library.

| Variable | Description | Default |
|---|---|---|
| `DEGOOG_JELLYFIN_URL` | Jellyfin server URL (e.g. `http://localhost:8096`). Command is disabled when unset. | _(disabled)_ |
| `DEGOOG_JELLYFIN_API_KEY` | Jellyfin API key for authentication | _(none)_ |

</details>

<details>
<summary><strong>Meilisearch (!meili / !ms)</strong></summary>

Enables the `!meili <query>` (alias: `!ms`) bang command to search across multiple Meilisearch indexes. Results from all indexes are merged together.

| Variable | Description | Default |
|---|---|---|
| `DEGOOG_MEILI_URL` | Meilisearch base URL (e.g. `http://localhost:7700`). Command is disabled when unset. | _(disabled)_ |
| `DEGOOG_MEILI_API_KEY` | API key for Bearer auth | _(none)_ |
| `DEGOOG_MEILI_INDEXES` | Comma-separated list of index names (e.g. `jellyfin_content,komga_content,romm_content`) | _(none)_ |
| `DEGOOG_MEILI_TITLE_FIELD` | Field name for result title | `title` |
| `DEGOOG_MEILI_URL_FIELD` | Field name for result URL | `url` |
| `DEGOOG_MEILI_CONTENT_FIELD` | Field name for result snippet/content | `content` |
| `DEGOOG_MEILI_THUMBNAIL_FIELD` | Field name for result thumbnail | `thumbnail` |
| `DEGOOG_MEILI_SOURCE_FIELD` | Field name for result source label | `source` |
| `DEGOOG_MEILI_TYPE_FIELD` | Field name for result type label | `type` |

</details>
