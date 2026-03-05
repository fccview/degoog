import type { BangCommand, CommandResult } from "../../types";

export const speedtestCommand: BangCommand = {
  name: "Speed Test",
  description: "Run an internet speed test",
  trigger: "speedtest",
  async execute(): Promise<CommandResult> {
    return {
      title: "Speed Test",
      html: `__RUN_SPEEDTEST__`,
    };
  },
};
