# Adding a new built-in command

1. **Create** `src/commands/builtins/<name>.ts` implementing the `BangCommand` interface (`name`, `description`, `trigger`, `execute(args, context?)` returning `CommandResult`).
2. **Register** in `src/commands/registry.ts`: add one entry to `BUILTIN_COMMANDS` with `id`, `trigger`, `displayName`, and your command instance.

No other files need changes. The command automatically appears in `!help` and is available via `!trigger`.
For local only commands, see [/howto/commands/README.md](/howto/commands/README.md).
