import { describe, expect, it } from "vitest";

import type { ProfilePoint } from "@/hooks/useElevationProfile";
import { elevationAtDistance } from "./elevationProfile";

const pt = (distance: number, elevation: number): ProfilePoint => ({
  distance,
  elevation,
  lon: 0,
  lat: 0,
});

// Deliberately uneven spacing: real profiles come from raw GPS points.
const points: ProfilePoint[] = [
  pt(0, 100),
  pt(10, 200),
  pt(100, 200),
  pt(140, 0),
];

describe("elevationAtDistance", () => {
  it("returns 0 for an empty profile", () => {
    expect(elevationAtDistance([], 50)).toBe(0);
  });

  it("returns the single point's elevation for a one-point profile", () => {
    expect(elevationAtDistance([pt(0, 42)], 999)).toBe(42);
  });

  it("clamps to the first point at or below the start", () => {
    expect(elevationAtDistance(points, 0)).toBe(100);
    expect(elevationAtDistance(points, -5)).toBe(100);
  });

  it("clamps to the last point at or beyond the end", () => {
    expect(elevationAtDistance(points, 140)).toBe(0);
    expect(elevationAtDistance(points, 1000)).toBe(0);
  });

  it("returns exact elevations at interior vertices", () => {
    expect(elevationAtDistance(points, 10)).toBe(200);
    expect(elevationAtDistance(points, 100)).toBe(200);
  });

  it("interpolates linearly within a segment", () => {
    // Halfway through 0->10, rising 100->200.
    expect(elevationAtDistance(points, 5)).toBe(150);
    // Flat segment.
    expect(elevationAtDistance(points, 55)).toBe(200);
    // A quarter through 100->140, falling 200->0.
    expect(elevationAtDistance(points, 110)).toBe(150);
  });

  it("handles duplicate distances without dividing by zero", () => {
    const dupes = [pt(0, 10), pt(50, 20), pt(50, 90), pt(100, 100)];
    expect(Number.isFinite(elevationAtDistance(dupes, 50))).toBe(true);
  });
});
