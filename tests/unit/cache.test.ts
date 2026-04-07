import { beforeEach, describe, expect, test } from "bun:test";
import type { SearchResponse } from "../../src/server/types";
import {
  clear,
  get,
  hasFailedEngines,
  NEWS_TTL_MS,
  set,
  SHORT_TTL_MS,
  TTL_MS,
} from "../../src/server/utils/cache";

const mockResponse = (timings: { resultCount: number }[]): SearchResponse => ({
  results: [],
  query: "test",
  totalTime: 0,
  type: "web",
  engineTimings: timings.map((t) => ({
    name: "e",
    time: 0,
    resultCount: t.resultCount,
  })),
  relatedSearches: [],
});

describe("cache", () => {
  beforeEach(() => {
    clear();
  });

  describe("get / set / clear", () => {
    test("returns null for missing key", () => {
      expect(get("missing")).toBe(null);
    });

    test("returns value after set", () => {
      const res = mockResponse([{ resultCount: 5 }]);
      set("k1", res);
      expect(get("k1")).toEqual(res);
    });

    test("clear removes all entries", () => {
      set("k1", mockResponse([{ resultCount: 1 }]));
      clear();
      expect(get("k1")).toBe(null);
    });

    test("returns null after TTL expires", async () => {
      const res = mockResponse([{ resultCount: 1 }]);
      set("k1", res, 50);
      expect(get("k1")).toEqual(res);
      await Bun.sleep(60);
      expect(get("k1")).toBe(null);
    });
  });

  describe("hasFailedEngines", () => {
    test("returns true when any engine has resultCount 0", () => {
      const res = mockResponse([{ resultCount: 5 }, { resultCount: 0 }]);
      expect(hasFailedEngines(res)).toBe(true);
    });

    test("returns false when all engines have results", () => {
      const res = mockResponse([{ resultCount: 3 }, { resultCount: 2 }]);
      expect(hasFailedEngines(res)).toBe(false);
    });
  });

  describe("TTL constants", () => {
    test("exports expected TTL constants", () => {
      expect(typeof TTL_MS).toBe("number");
      expect(typeof SHORT_TTL_MS).toBe("number");
      expect(typeof NEWS_TTL_MS).toBe("number");
      expect(TTL_MS).toBeGreaterThan(SHORT_TTL_MS);
    });
  });
});
