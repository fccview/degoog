# Custom Bang Command Aliases

You can define custom aliases for any bang command by creating a JSON file.

## Setup

1. Copy the example file:
   ```sh
   cp data/aliases.example.json data/aliases.json
   ```

2. Edit `data/aliases.json` with your aliases:
   ```json
   {
     "jelly": "jellyfin",
     "search": "meili",
     "id": "uuid"
   }
   ```

   Each key is the alias trigger, and the value is the target command trigger.

3. Restart the server. Aliases are loaded at startup.

## How it works

- Keys are the alias (what you type after `!`)
- Values are the trigger of an existing bang command
- Aliases cannot override existing command triggers or built-in aliases
- User aliases show up in `!help` next to their target command

## Built-in aliases

Some commands ship with aliases defined in their source:

| Command | Aliases |
|---|---|
| `!jellyfin` | `!jf` |
| `!meili` | `!ms` |

## Engine shortcuts

Search engines can define a `bangShortcut` to enable single-engine search:

| Shortcut | Engine |
|---|---|
| `!g` | Google |
| `!b` | Bing |
| `!ddg` | DuckDuckGo |
| `!brave` | Brave Search |
| `!w` | Wikipedia |
| `!r` | Reddit |

Usage: `!g linux kernel` searches only Google for "linux kernel".

## Custom path

Set `DEGOOG_ALIASES_FILE` to load aliases from a different location:

```sh
DEGOOG_ALIASES_FILE=/etc/degoog/aliases.json
```
