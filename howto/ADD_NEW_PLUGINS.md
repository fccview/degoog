# Adding a new built-in command

1. **Create** `src/commands/builtins/<name>.ts` implementing the `BangCommand` interface (`name`, `description`, `trigger`, `execute(args, context?)` returning `Promise<CommandResult>`).
2. **Register** in `src/commands/registry.ts`: add one entry to `BUILTIN_COMMANDS` with `id`, `trigger`, `displayName`, and your command instance.

No other files need changes. The command automatically appears in `!help` and is available via `!trigger`.

## Optional: configurable settings

If your command requires user-provided configuration (e.g. a server URL or API key), add a `settingsSchema` and read values from `plugin-settings.ts` at execute time:

```ts
import { getSettings } from "../../plugin-settings";

export const MY_COMMAND_ID = "my-command"; // must match id in BUILTIN_COMMANDS

export const myCommand: BangCommand = {
  name: "My Command",
  description: "Does something useful",
  trigger: "mycommand",

  settingsSchema: [
    {
      key: "serverUrl",
      label: "Server URL",
      type: "url",
      required: true,
      placeholder: "https://my-server.example.com",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      secret: true,
    },
  ],

  configure(_settings: Record<string, string>): void {},

  async isConfigured(): Promise<boolean> {
    const stored = await getSettings(MY_COMMAND_ID);
    return !!stored["serverUrl"];
  },

  async execute(args: string): Promise<CommandResult> {
    const stored = await getSettings(MY_COMMAND_ID);
    const serverUrl = stored["serverUrl"] ?? "";
    const apiKey = stored["apiKey"] ?? "";
    if (!serverUrl) {
      return { title: "Not configured", html: `<p>Configure via <a href="/settings">Settings → Plugins</a>.</p>` };
    }
    // ...
  },
};
```

- The Configure button and modal are generated automatically in Settings → Plugins from the schema.
- `isConfigured()` returning `false` hides the command from `!help` until configured.
- Configurable built-in plugins and all custom plugins have a toggle switch in Settings → Plugins that allows users to fully disable them. Disabled plugins are hidden from `!help` and return an error when invoked.

For external (non-built-in) plugins, see [/howto/plugins/README.md](/howto/plugins/README.md).
