import type { BangCommand } from "../types";
import { helpCommand } from "./builtins/help";
import { uuidCommand } from "./builtins/uuid";
import { ipCommand } from "./builtins/ip";
import { speedtestCommand } from "./builtins/speedtest";
import { jellyfinCommand } from "./builtins/jellyfin";

interface CommandEntry {
  id: string;
  trigger: string;
  displayName: string;
  instance: BangCommand;
}

const BUILTIN_COMMANDS: CommandEntry[] = [
  { id: "help", trigger: "help", displayName: "Help", instance: helpCommand },
  { id: "uuid", trigger: "uuid", displayName: "UUID Generator", instance: uuidCommand },
  { id: "ip", trigger: "ip", displayName: "IP Lookup", instance: ipCommand },
  { id: "speedtest", trigger: "speedtest", displayName: "Speed Test", instance: speedtestCommand },
  ...(process.env.DEGOOG_JELLYFIN_URL
    ? [{ id: "jellyfin", trigger: "jellyfin", displayName: "Jellyfin", instance: jellyfinCommand }]
    : []),
];

interface PluginCommandEntry {
  id: string;
  trigger: string;
  displayName: string;
  instance: BangCommand;
}

let pluginCommands: PluginCommandEntry[] = [];

function isBangCommand(val: unknown): val is BangCommand {
  return (
    typeof val === "object" &&
    val !== null &&
    "name" in val &&
    typeof (val as BangCommand).name === "string" &&
    "trigger" in val &&
    typeof (val as BangCommand).trigger === "string" &&
    "execute" in val &&
    typeof (val as BangCommand).execute === "function"
  );
}

export async function initCommandPlugins(): Promise<void> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");
  const { pathToFileURL } = await import("url");
  const commandDir =
    process.env.DEGOOG_COMMANDS_DIR ?? join(process.cwd(), "data", "commands");
  const seen = new Set<string>(BUILTIN_COMMANDS.map((c) => c.trigger));
  pluginCommands = [];

  try {
    const files = await readdir(commandDir);
    for (const file of files) {
      if (!/\.(js|ts|mjs|cjs)$/.test(file)) continue;
      const base = file.replace(/\.(js|ts|mjs|cjs)$/, "");
      const id = `cmd-${base}`;

      try {
        const fullPath = join(commandDir, file);
        const url = pathToFileURL(fullPath).href;
        const mod = await import(url);
        const Export = mod.default ?? mod.command ?? mod.Command;
        const instance: BangCommand =
          typeof Export === "function" ? new Export() : Export;
        if (!isBangCommand(instance)) continue;
        if (seen.has(instance.trigger)) continue;
        seen.add(instance.trigger);
        pluginCommands.push({
          id,
          trigger: instance.trigger,
          displayName: instance.name,
          instance,
        });
      } catch {
      }
    }
  } catch {
  }
}

export function getCommandMap(): Map<string, BangCommand> {
  const map = new Map<string, BangCommand>();
  for (const cmd of BUILTIN_COMMANDS) {
    map.set(cmd.trigger, cmd.instance);
  }
  for (const cmd of pluginCommands) {
    map.set(cmd.trigger, cmd.instance);
  }
  return map;
}

export function getCommandRegistry(): { trigger: string; name: string; description: string }[] {
  const all = [...BUILTIN_COMMANDS, ...pluginCommands];
  return all.map((c) => ({
    trigger: c.instance.trigger,
    name: c.instance.name,
    description: c.instance.description,
  }));
}

export function matchBangCommand(
  query: string,
): { command: BangCommand; args: string } | null {
  const trimmed = query.trim();
  if (!trimmed.startsWith("!")) return null;
  const withoutBang = trimmed.slice(1);
  const spaceIdx = withoutBang.indexOf(" ");
  const trigger = spaceIdx === -1 ? withoutBang : withoutBang.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : withoutBang.slice(spaceIdx + 1);
  const map = getCommandMap();
  const command = map.get(trigger.toLowerCase());
  if (!command) return null;
  return { command, args };
}
