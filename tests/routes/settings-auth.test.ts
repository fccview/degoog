import { describe, test, expect } from "bun:test";
import { getSettingsTokenFromRequest } from "../../src/routes/settings-auth";

describe("routes/settings-auth", () => {
  test("getSettingsTokenFromRequest returns undefined when no cookie or header", () => {
    const req = new Request("http://localhost/", { headers: {} });
    const c = {
      req: Object.assign(req, {
        header: (name: string) => req.headers.get(name) ?? undefined,
        query: (name: string) => new URL(req.url).searchParams.get(name) ?? undefined,
      }),
    };
    const token = getSettingsTokenFromRequest(c as unknown as Parameters<typeof getSettingsTokenFromRequest>[0]);
    expect(token).toBeUndefined();
  });

  test("getSettingsTokenFromRequest returns token from x-settings-token header", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-settings-token": "abc123" },
    });
    const c = {
      req: Object.assign(req, {
        header: (name: string) => req.headers.get(name) ?? undefined,
        query: (name: string) => new URL(req.url).searchParams.get(name) ?? undefined,
      }),
    };
    const token = getSettingsTokenFromRequest(c as unknown as Parameters<typeof getSettingsTokenFromRequest>[0]);
    expect(token).toBe("abc123");
  });
});
