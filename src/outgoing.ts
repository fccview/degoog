import { fetch as undiciFetch, ProxyAgent } from "undici";
import { getSettings } from "./plugin-settings";
import { debug } from "./logger";

const DEGOOG_SETTINGS_ID = "degoog-settings";

let allowedHosts: Set<string> | null = null;

export function setOutgoingAllowlist(hosts: string[]): void {
  if (!hosts || hosts.length === 0) {
    allowedHosts = new Set();
    return;
  }
  const normalized = hosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
  const extra = process.env.DEGOOG_OUTGOING_ALLOWED_HOSTS ?? "";
  const fromEnv = extra
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  allowedHosts = new Set([...normalized, ...fromEnv]);
}

let proxyIndex = 0;

function parseProxyUrls(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isUrlAllowedForOutgoing(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
  } catch {
    return false;
  }
  if (!allowedHosts) return true;
  if (allowedHosts.size === 0) return false;
  if (allowedHosts.has("*")) return true;
  const host = new URL(url).hostname.toLowerCase();
  return allowedHosts.has(host);
}

export interface OutgoingFetchOptions {
  headers?: Record<string, string>;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
}

export async function outgoingFetch(
  url: string,
  options: OutgoingFetchOptions = {},
): Promise<Response> {
  const settings = await getSettings(DEGOOG_SETTINGS_ID);
  const enabled = settings.proxyEnabled === "true";
  const proxyUrlsRaw = settings.proxyUrls;
  const urls = parseProxyUrls(
    typeof proxyUrlsRaw === "string" ? proxyUrlsRaw : "",
  );

  const useProxy = enabled && urls.length > 0;
  const opts: RequestInit = {
    redirect: options.redirect ?? "follow",
    signal: options.signal,
    headers: options.headers,
  };

  if (!useProxy) {
    debug("outgoing", `direct fetch ${new URL(url).hostname}`);
    return fetch(url, opts);
  }

  const proxyUrl = urls[proxyIndex++ % urls.length];
  debug("outgoing", `via proxy ${proxyUrl} -> ${new URL(url).hostname}`);
  const agent = new ProxyAgent(proxyUrl);
  const dispatcherOpts = {
    method: "GET",
    redirect: opts.redirect ?? "follow",
    signal: opts.signal,
    headers: opts.headers,
  };
  return undiciFetch(url, {
    ...dispatcherOpts,
    dispatcher: agent,
  }) as unknown as Promise<Response>;
}
