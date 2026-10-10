// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RouteTrack } from "@/domain/timedTrack";
import { useElevationProfile } from "./useElevationProfile";

vi.mock("@arcgis/core/layers/GraphicsLayer", () => ({
  default: class GraphicsLayer {},
}));
vi.mock("@arcgis/core/Graphic", () => ({ default: class Graphic {} }));
vi.mock("@arcgis/core/symbols/SimpleMarkerSymbol", () => ({
  default: class SimpleMarkerSymbol {},
}));
vi.mock("@arcgis/core/geometry/Point", () => ({ default: class Point {} }));

const track = {
  kind: "legacy",
  reason: "missing-coordinate-times",
  totalDistanceM: 100,
  profilePoints: [
    {
      distance: 0,
      elevation: 10,
      lon: -123,
      lat: 49,
      segmentIndex: 0,
      pointIndex: 0,
    },
    {
      distance: 100,
      elevation: 20,
      lon: -122,
      lat: 50,
      segmentIndex: 0,
      pointIndex: 1,
    },
  ],
} satisfies RouteTrack;

describe("useElevationProfile", () => {
  it("keeps hover callbacks stable across parent rerenders", () => {
    const { result, rerender } = renderHook(() =>
      useElevationProfile(track, null),
    );
    const firstOnHover = result.current.onHover;
    const firstOnHoverEnd = result.current.onHoverEnd;

    rerender();

    expect(result.current.onHover).toBe(firstOnHover);
    expect(result.current.onHoverEnd).toBe(firstOnHoverEnd);
  });
});
