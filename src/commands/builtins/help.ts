import type { BangCommand, CommandResult } from "../../types";
import { getCommandRegistry } from "../registry";

export const helpCommand: BangCommand = {
  name: "Help",
  description: "List all available bang commands",
  trigger: "help",
  async execute(): Promise<CommandResult> {
    const commands = getCommandRegistry();
    const rows = commands
      .map(
        (c) =>
          `<tr><td class="command-trigger">!${c.trigger}</td><td>${c.name}</td><td>${c.description}</td></tr>`,
      )
      .join("");
    return {
      title: "Available Commands",
      html: `<div class="command-result"><table class="command-help-table"><thead><tr><th>Command</th><th>Name</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    };
  },
};
