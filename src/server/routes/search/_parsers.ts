import { getEngineRegistry } from "../../extensions/engines/registry";
import type { EngineConfig } from "../../types";

export function parsePage(raw: unknown): number {
  return Math.max(1, Math.min(10, Math.floor(Number(raw)) || 1));
}

export function parseEnginesFromBody(enabledList?: string[]): EngineConfig {
  const registry = getEngineRegistry();
  const enabledSet = enabledList ? new Set(enabledList) : null;
  const engines: EngineConfig = {};
  for (const { id } of registry) {
    engines[id] = enabledSet ? enabledSet.has(id) : true;
  }
  return engines;
}
