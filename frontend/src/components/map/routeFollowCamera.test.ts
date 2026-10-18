import type { AnimationPosition } from "@/domain/routeAnimation";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRouteFollowCamera,
  captureFollowZoom,
  centerRoutePosition,
  FOLLOW_TRANSITION_DURATION_MS,
} from "./routeFollowCamera";

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
      {
        animate: true,
        duration: FOLLOW_TRANSITION_DURATION_MS,
        easing: "ease-in-out",
      },
    );
  });
});

function adapterFrame(coordinate: readonly [number, number]) {
  return {
    state: "playing" as const,
    playbackMode: "distance" as const,
    skipDetectedStops: false,
    playbackProgress: 0.2,
    distanceProgress: 0.2,
    activePauseReasons: [],
    positionRevision: 0,
    position: {
      coordinate,
      pointIndex: 0,
      cumulativeDistanceM: 0,
      originalElapsedMs: null,
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("ArcGIS visibility adapter", () => {
  it.each(["2d", "3d"])(
    "projects ground positions locally and preserves %s orientation, zoom, timing and cancellation",
    async (type) => {
      vi.useFakeTimers();
      const rawView = {
        type,
        ready: true,
        width: 1000,
        height: 800,
        padding: {},
        rotation: 27,
        camera: { heading: 42, tilt: 63 },
        toScreen: vi.fn(() => ({ x: 790, y: 400 })),
        goTo: vi.fn().mockResolvedValue(undefined),
      };
      const current = adapterFrame([-123, 49]);
      const camera = createRouteFollowCamera(
        rawView as never,
        () => current.position,
        () => false,
      );
      camera.setZoom(12);
      camera.setEnabled(true);
      camera.update(current);
      expect(rawView.toScreen).toHaveBeenCalledWith(
        expect.objectContaining({ longitude: -123, latitude: 49, hasZ: false }),
      );
      expect(rawView.goTo).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining(
          type === "3d"
            ? { zoom: 12, heading: 42, tilt: 63 }
            : { zoom: 12, rotation: 27 },
        ),
        expect.objectContaining({
          animate: true,
          duration: FOLLOW_TRANSITION_DURATION_MS,
          signal: expect.any(AbortSignal),
        }),
      );
      camera.destroy();
      await vi.advanceTimersByTimeAsync(1000);
    },
  );

  it.each(["2d", "3d"])(
    "reserves mobile playback-control space in %s",
    (type) => {
      vi.useFakeTimers();
      const rawView = {
        type,
        ready: true,
        width: 360,
        height: 500,
        padding: { left: 10, right: 10 },
        rotation: 0,
        camera: { heading: 0, tilt: 45 },
        toScreen: vi.fn(() => ({ x: 180, y: 440 })),
        goTo: vi.fn().mockResolvedValue(undefined),
      };
      const current = adapterFrame([-123, 49]);
      const camera = createRouteFollowCamera(
        rawView as never,
        () => current.position,
        () => false,
      );
      camera.setZoom(12);
      camera.setEnabled(true);
      camera.update(current);
      // Still within the raw viewport, but behind the playback controls.
      expect(rawView.goTo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ animate: false }),
      );
      camera.destroy();
    },
  );

  it("adds top clearance for the lifted 3D icon", () => {
    vi.useFakeTimers();
    for (const type of ["2d", "3d"]) {
      const rawView = {
        type,
        ready: true,
        width: 1000,
        height: 800,
        padding: {},
        rotation: 0,
        camera: { heading: 0, tilt: 45 },
        toScreen: vi.fn(() => ({ x: 500, y: 175 })),
        goTo: vi.fn().mockResolvedValue(undefined),
      };
      const current = adapterFrame([-123, 49]);
      const camera = createRouteFollowCamera(
        rawView as never,
        () => current.position,
        () => false,
      );
      camera.setZoom(12);
      camera.setEnabled(true);
      camera.update(current);
      expect(rawView.goTo.mock.calls.length).toBe(type === "3d" ? 1 : 0);
      camera.destroy();
    }
  });

  it("waits for a ready view and tolerates failed projections", async () => {
    vi.useFakeTimers();
    const rawView = {
      type: "2d",
      ready: false,
      width: 1000,
      height: 800,
      padding: {},
      rotation: 0,
      toScreen: vi.fn(() => {
        throw new Error("projection unavailable");
      }),
      goTo: vi.fn().mockResolvedValue(undefined),
    };
    const current = adapterFrame([-123, 49]);
    const camera = createRouteFollowCamera(
      rawView as never,
      () => current.position,
      () => false,
    );
    camera.setZoom(12);
    camera.setEnabled(true);
    camera.update(current);
    expect(rawView.toScreen).not.toHaveBeenCalled();
    rawView.ready = true;
    await vi.advanceTimersByTimeAsync(200);
    expect(rawView.goTo).not.toHaveBeenCalled();
    camera.destroy();
  });
});
