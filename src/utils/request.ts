import type { Context } from "hono";

interface BunEnv {
  requestIP?: (req: Request) => { address: string } | null;
}

export function getClientIp(c: Context): string | undefined {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  const env = c.env as BunEnv | undefined;
  return env?.requestIP?.(c.req.raw)?.address ?? undefined;
}
