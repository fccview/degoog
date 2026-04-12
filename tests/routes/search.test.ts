import { describe, test, expect, beforeAll } from "bun:test";

let searchRouter: {
  request: (req: Request | string) => Response | Promise<Response>;
};

beforeAll(async () => {
  const mod = await import("../../src/server/routes/search");
  searchRouter = mod.default;
});

describe("routes/search", () => {
  test("GET /api/search without q returns 400", async () => {
    const res = await searchRouter.request(
      "http://localhost/api/search?google=true",
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("query");
  });

  test("GET /api/lucky without q returns 400", async () => {
    const res = await searchRouter.request("http://localhost/api/lucky");
    expect(res.status).toBe(400);
  });
});
