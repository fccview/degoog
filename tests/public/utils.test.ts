import { describe, test, expect } from "bun:test";
import { cleanUrl, cleanHostname } from "../../src/client/utils/dom";

describe("public/utils", () => {
  test("cleanUrl returns hostname + pathname", () => {
    expect(cleanUrl("https://example.com/path/to?q=1")).toBe("example.com/path/to");
  });

  test("cleanUrl returns url as-is for invalid url", () => {
    expect(cleanUrl("not-a-url")).toBe("not-a-url");
  });

  test("cleanHostname returns hostname", () => {
    expect(cleanHostname("https://sub.example.com/path")).toBe("sub.example.com");
  });

  test("cleanHostname returns url as-is for invalid url", () => {
    expect(cleanHostname("xxx")).toBe("xxx");
  });
});
