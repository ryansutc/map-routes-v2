import { describe, expect, it } from "vitest";

import { getRouteTitleError, normalizeRouteTitle } from "./routeTitle";

describe("route title validation", () => {
  it("rejects empty and whitespace-only titles with a clear message", () => {
    expect(getRouteTitleError("")).toBe("Title is required");
    expect(getRouteTitleError("  \t\n")).toBe("Title is required");
  });

  it("trims valid titles", () => {
    expect(getRouteTitleError("  Morning ridge  ")).toBeNull();
    expect(normalizeRouteTitle("  Morning ridge  ")).toBe("Morning ridge");
  });

  it("enforces the 255-character limit after trimming", () => {
    expect(getRouteTitleError("x".repeat(255))).toBeNull();
    expect(getRouteTitleError(`  ${"x".repeat(255)}  `)).toBeNull();
    expect(getRouteTitleError("x".repeat(256))).toBe(
      "Title must be 255 characters or fewer",
    );
  });
});
