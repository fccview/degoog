import { getAllSettings, setSettings } from "./plugin-settings";

const ORDER_KEY = "__pluginOrder";

export async function getPluginOrder(): Promise<string[]> {
  const store = await getAllSettings();
  const raw = store[ORDER_KEY];
  if (!raw) return [];
  const order = raw["order"];
  if (Array.isArray(order)) return order.filter((v) => typeof v === "string");
  return [];
}

export async function setPluginOrder(order: string[]): Promise<void> {
  await setSettings(ORDER_KEY, { order });
}

export function applyPluginOrder<T>(
  items: T[],
  order: string[],
  getId: (item: T) => string,
): T[] {
  if (order.length === 0) return items;
  const indexMap = new Map(order.map((id, i) => [id, i]));
  const fallback = order.length;
  return [...items].sort(
    (a, b) =>
      (indexMap.get(getId(a)) ?? fallback) -
      (indexMap.get(getId(b)) ?? fallback),
  );
}
