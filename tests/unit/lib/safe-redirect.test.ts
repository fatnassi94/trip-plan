import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/account", "/trip/abc?day=2", "/trip/abc#map"])("allows same-site path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "account",
    "/acc\nount",
  ])("falls back for unsafe target %j", (target) => {
    expect(safeRedirectPath(target)).toBe("/account");
  });

  it("uses the fallback when there is no target", () => {
    expect(safeRedirectPath(null)).toBe("/account");
    expect(safeRedirectPath("", "/")).toBe("/");
  });
});
