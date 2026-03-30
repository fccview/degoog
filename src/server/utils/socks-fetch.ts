import { SocksProxyAgent } from "socks-proxy-agent";
import https from "node:https";
import http from "node:http";
import {
  createGunzip,
  createInflate,
  createBrotliDecompress,
} from "node:zlib";
import type { Readable } from "node:stream";
import type { OutgoingFetchOptions } from "./outgoing";

const SOCKS_PREFIX_RE = /^socks[45h]*:\/\//i;
const MAX_REDIRECTS = 5;

export function isSocksProxy(proxyUrl: string): boolean {
  return SOCKS_PREFIX_RE.test(proxyUrl);
}

function toWebResponse(
  res: http.IncomingMessage,
  body: Buffer,
): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return new Response(new Uint8Array(body), {
    status: res.statusCode ?? 200,
    statusText: res.statusMessage ?? "",
    headers,
  });
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function decompressStream(
  res: http.IncomingMessage,
): Readable {
  const encoding = (res.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return res.pipe(createGunzip());
  if (encoding === "deflate") return res.pipe(createInflate());
  if (encoding === "br") return res.pipe(createBrotliDecompress());
  return res;
}

export async function fetchViaSocks(
  url: string,
  proxyUrl: string,
  options: OutgoingFetchOptions = {},
): Promise<Response> {
  const agent = new SocksProxyAgent(proxyUrl);
  const followRedirects = (options.redirect ?? "follow") !== "manual";

  const doRequest = (
    targetUrl: string,
    redirectsLeft: number = MAX_REDIRECTS,
  ): Promise<Response> => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        targetUrl,
        {
          method: options.method ?? "GET",
          headers: options.headers,
          agent,
          signal: options.signal ?? undefined,
        },
        (res) => {
          const status = res.statusCode ?? 200;

          if (
            followRedirects &&
            isRedirect(status) &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            const next = new URL(res.headers.location, targetUrl).href;
            res.resume();
            resolve(doRequest(next, redirectsLeft - 1));
            return;
          }

          const stream = decompressStream(res);
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () =>
            resolve(toWebResponse(res, Buffer.concat(chunks))),
          );
          stream.on("error", reject);
        },
      );

      req.on("error", reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  };

  return doRequest(url);
}
