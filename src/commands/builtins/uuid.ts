import type { BangCommand, CommandResult } from "../../types";

export const uuidCommand: BangCommand = {
  name: "UUID Generator",
  description: "Generate a random UUID v4",
  trigger: "uuid",
  async execute(): Promise<CommandResult> {
    const uuid = crypto.randomUUID();
    return {
      title: "Generated UUID",
      html: `<div class="command-result command-uuid"><code id="uuid-value">${uuid}</code><button onclick="navigator.clipboard.writeText(document.getElementById('uuid-value').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button></div>`,
    };
  },
};
