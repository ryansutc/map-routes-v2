import type { AnimationPosition } from "@/domain/routeAnimation";
import { describe, expect, it, vi } from "vitest";
import { captureFollowZoom, centerRoutePosition } from "./routeFollowCamera";

const position: AnimationPosition = {
  coordinate: [-123, 49, 100],
  pointIndex: 0,
  originalElapsedMs: 0,
  cumulativeDistanceM: 0,
};

describe("route follow camera", () => {
  it("captures one zoom level closer and preserves 2D rotation", async () => {
    const rawView = {
      type: "2d",
      zoom: 8,
      rotation: 27,
      goTo: vi.fn().mockResolvedValue(undefined),
    };
    const view = rawView as never;

    const zoom = captureFollowZoom(view);
    await centerRoutePosition(view, position, zoom, false);

    expect(zoom).toBe(9);
    expect(rawView.goTo).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ longitude: -123, latitude: 49 }),
        zoom: 9,
        rotation: 27,
      }),
      { animate: false },
    );
  });

  it("preserves 3D heading and tilt", async () => {
    const rawView = {
      type: "3d",
      zoom: 11,
      camera: { heading: 42, tilt: 63 },
      goTo: vi.fn().mockResolvedValue(undefined),
    };
    const view = rawView as never;

    await centerRoutePosition(view, position, 12, true);

    expect(rawView.goTo).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 12, heading: 42, tilt: 63 }),
      { animate: true },
    );
  });
});
