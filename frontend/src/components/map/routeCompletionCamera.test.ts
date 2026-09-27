import { buildRouteTrack } from "@/domain/timedTrack";
import { describe, expect, it, vi } from "vitest";
import {
  routeTrackExtent,
  showCompletedRouteOverview,
} from "./routeCompletionCamera";

const track = buildRouteTrack({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-123, 49],
          [-122.5, 49.5],
        ],
      },
      properties: {},
    },
  ],
});

describe("completed route camera overview", () => {
  it("derives its extent from the canonical route track", () => {
    expect(routeTrackExtent(track)?.toJSON()).toMatchObject({
      xmin: -123,
      xmax: -122.5,
      ymin: 49,
      ymax: 49.5,
    });
  });

  it("preserves 2D rotation and pulls back one level without animation for reduced motion", async () => {
    const view = {
      type: "2d",
      rotation: 27,
      zoom: 12,
      goTo: vi.fn().mockResolvedValue(undefined),
    };

    await showCompletedRouteOverview(view as never, track, true);

    expect(view.goTo).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ rotation: 27 }),
      expect.objectContaining({ animate: false }),
    );
    expect(view.goTo).toHaveBeenNthCalledWith(
      2,
      { zoom: 11, rotation: 27 },
      expect.objectContaining({ animate: false }),
    );
  });

  it("preserves 3D heading and tilt", async () => {
    const view = {
      type: "3d",
      camera: { heading: 42, tilt: 63 },
      zoom: 9,
      goTo: vi.fn().mockResolvedValue(undefined),
    };

    await showCompletedRouteOverview(view as never, track, false);

    expect(view.goTo).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ heading: 42, tilt: 63 }),
      expect.objectContaining({ animate: true }),
    );
    expect(view.goTo).toHaveBeenNthCalledWith(
      2,
      { zoom: 8, heading: 42, tilt: 63 },
      expect.objectContaining({ animate: true }),
    );
  });
});
