# Custom bang commands

Drop command modules here to add them to deGoog. Each file must export a **BangCommand**: an object or class with:

- **`name`** (string) – display name in help listing
- **`description`** (string) – short description of what the command does
- **`trigger`** (string) – the word after `!` that activates this command
- **`execute(args, context?)`** (async function) – returns `Promise<CommandResult>`

**CommandResult** shape: `{ title: string, html: string }`

**CommandContext** shape: `{ clientIp?: string }`

Supported extensions: `.js`, `.ts`, `.mjs`, `.cjs`.
Command id is derived from the filename with a `cmd-` prefix (e.g. `my-command.js` → id `cmd-my-command`).

Create a `./data/commands` folder on the root of your project or set `DEGOOG_COMMANDS_DIR` to load commands from another directory.
