import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_ROUTE_DURATION_SEC,
  TARGET_ROUTE_DURATIONS_SEC,
  availablePlaybackModes,
  createRouteAnimationEngine,
  resolvePlaybackMode,
  type AnimationFrameClock,
} from "./routeAnimation";
import { buildRouteTrack, type RouteTrack } from "./timedTrack";

function routeTrack(times?: string[]): RouteTrack {
  return buildRouteTrack({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.001, 0],
            [0.003, 0],
          ],
        },
        properties: times === undefined ? {} : { coordinate_times: times },
      },
    ],
  });
}

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, (timestamp: number) => void>();
  const clock: AnimationFrameClock = {
    requestFrame: (callback) => {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame: (requestId) => callbacks.delete(requestId),
  };
  return {
    clock,
    step(milliseconds: number) {
      now += milliseconds;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(now));
    },
  };
}

const timedTrack = () =>
  routeTrack([
    "2026-01-01T00:00:00Z",
    "2026-01-01T00:01:30Z",
    "2026-01-01T00:01:40Z",
  ]);

const defaultSettings = {
  skipDetectedStops: false,
} as const;

function stopTrack(): RouteTrack {
  return buildRouteTrack({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.00004, 0],
            [0.00002, 0],
            [0.001, 0],
            [0.003, 0],
          ],
        },
        properties: {
          coordinate_times: [
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:01:00Z",
            "2026-01-01T00:02:00Z",
            "2026-01-01T00:02:01Z",
            "2026-01-01T00:03:00Z",
          ],
        },
      },
    ],
  });
}

describe("route playback preferences", () => {
  it("defines the supported target route durations and default", () => {
    expect(TARGET_ROUTE_DURATIONS_SEC).toEqual([10, 20, 30, 60, 120]);
    expect(DEFAULT_TARGET_ROUTE_DURATION_SEC).toBe(20);
  });

  it("offers and resolves modes according to timestamp capability", () => {
    const timed = timedTrack();
    const legacy = routeTrack();

    expect(availablePlaybackModes(timed)).toEqual(["recorded", "distance"]);
    expect(availablePlaybackModes(legacy)).toEqual(["indexed", "distance"]);
    expect(resolvePlaybackMode(timed, "indexed")).toBe("recorded");
    expect(resolvePlaybackMode(legacy, "recorded")).toBe("indexed");
    expect(resolvePlaybackMode(timed, "distance")).toBe("distance");
  });
});

describe("route animation engine", () => {
  it("reaches recorded observations at their compressed timeline fractions", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      timedTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );

    engine.play();
    fake.step(0);
    fake.step(9_000);

    expect(engine.getSnapshot().playbackProgress).toBe(0.9);
    expect(engine.getSnapshot().position?.coordinate).toEqual([0.001, 0]);
  });

  it("separates recorded timeline progress from spatial distance progress", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      timedTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );

    engine.play();
    fake.step(0);
    fake.step(5_000);

    expect(engine.getSnapshot().state).toBe("playing");
    expect(engine.getSnapshot().playbackProgress).toBe(0.5);
    expect(engine.getSnapshot().distanceProgress).toBeLessThan(0.25);
  });

  it("moves by cumulative distance in constant-speed mode", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      timedTrack(),
      { ...defaultSettings, playbackMode: "distance", targetDurationSec: 10 },
      fake.clock,
    );

    engine.play();
    fake.step(0);
    fake.step(5_000);

    expect(engine.getSnapshot().playbackProgress).toBe(0.5);
    expect(engine.getSnapshot().distanceProgress).toBeCloseTo(0.5);
    expect(engine.getSnapshot().position?.coordinate[0]).toBeCloseTo(0.0015);
  });

  it("retains GPS-point playback for legacy routes", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      routeTrack(),
      { ...defaultSettings, playbackMode: "indexed", targetDurationSec: 10 },
      fake.clock,
    );

    engine.play();
    fake.step(0);
    fake.step(5_000);

    expect(engine.getSnapshot()).toMatchObject({
      playbackMode: "indexed",
      playbackProgress: 0.5,
      position: { pointIndex: 1, coordinate: [0.001, 0] },
    });
  });

  it("preserves its cursor until every composed pause reason clears", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      timedTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );
    engine.play();
    fake.step(0);
    fake.step(2_000);
    const pausedAt = engine.getSnapshot().playbackProgress;

    const releaseFirstPhotoPause = engine.acquirePause("photo");
    const releaseSecondPhotoPause = engine.acquirePause("photo");
    const releaseVisibilityPause = engine.acquirePause("document-hidden");
    fake.step(5_000);
    releaseVisibilityPause();

    expect(engine.getSnapshot().state).toBe("paused");
    expect(engine.getSnapshot().playbackProgress).toBe(pausedAt);

    releaseFirstPhotoPause();
    expect(engine.getSnapshot().state).toBe("paused");

    releaseSecondPhotoPause();
    fake.step(0);
    fake.step(1_000);

    expect(engine.getSnapshot().state).toBe("playing");
    expect(engine.getSnapshot().playbackProgress).toBeCloseTo(0.3);
  });

  it("completes, stops, and replays with explicit lifecycle states", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      routeTrack(),
      { ...defaultSettings, playbackMode: "indexed", targetDurationSec: 10 },
      fake.clock,
    );
    engine.play();
    fake.step(0);
    fake.step(10_000);
    expect(engine.getSnapshot()).toMatchObject({
      state: "completed",
      playbackProgress: 1,
    });

    engine.play();
    expect(engine.getSnapshot()).toMatchObject({
      state: "playing",
      playbackProgress: 0,
    });
    engine.stop();
    expect(engine.getSnapshot()).toMatchObject({
      state: "idle",
      playbackProgress: 0,
    });
  });

  it("ends session-owned pauses on stop while retaining document visibility", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      timedTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );
    engine.play();
    engine.acquirePause("photo");
    engine.acquirePause("document-hidden");

    engine.stop();

    expect(engine.getSnapshot()).toMatchObject({
      state: "idle",
      activePauseReasons: ["document-hidden"],
    });
  });

  it("rebases through the current position when playback mode changes", () => {
    const fake = fakeClock();
    const track = timedTrack();
    const engine = createRouteAnimationEngine(
      track,
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );
    engine.play();
    fake.step(0);
    fake.step(9_000);
    const longitude = engine.getSnapshot().position?.coordinate[0];

    engine.configure({
      ...defaultSettings,
      playbackMode: "distance",
      targetDurationSec: 20,
    });

    expect(engine.getSnapshot().playbackMode).toBe("distance");
    expect(engine.getSnapshot().position?.coordinate[0]).toBeCloseTo(
      longitude ?? 0,
    );
  });

  it("resolves an instantaneous recorded timeline without stalling", () => {
    const fake = fakeClock();
    const track = routeTrack([
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]);
    const engine = createRouteAnimationEngine(
      track,
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 20 },
      fake.clock,
    );

    engine.play();

    expect(engine.getSnapshot()).toMatchObject({
      state: "completed",
      playbackProgress: 1,
      position: { pointIndex: 2, coordinate: [0.003, 0] },
    });
  });

  it("includes or collapses detected stops only in recorded-time mode", () => {
    const includedClock = fakeClock();
    const skippedClock = fakeClock();
    const included = createRouteAnimationEngine(
      stopTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      includedClock.clock,
    );
    const skipped = createRouteAnimationEngine(
      stopTrack(),
      {
        ...defaultSettings,
        playbackMode: "recorded",
        targetDurationSec: 10,
        skipDetectedStops: true,
      },
      skippedClock.clock,
    );

    included.play();
    skipped.play();
    includedClock.step(0);
    skippedClock.step(0);
    includedClock.step(5_000);
    skippedClock.step(5_000);

    expect(included.getSnapshot().position?.coordinate[0]).toBeLessThan(0.0001);
    expect(skipped.getSnapshot().position?.coordinate[0]).toBeGreaterThan(
      0.001,
    );

    const distanceClock = fakeClock();
    const distance = createRouteAnimationEngine(
      stopTrack(),
      {
        ...defaultSettings,
        playbackMode: "distance",
        targetDurationSec: 10,
        skipDetectedStops: true,
      },
      distanceClock.clock,
    );
    distance.play();
    distanceClock.step(0);
    distanceClock.step(5_000);
    const skippedDistanceLongitude =
      distance.getSnapshot().position?.coordinate[0];
    distance.configure({
      ...defaultSettings,
      playbackMode: "distance",
      targetDurationSec: 10,
      skipDetectedStops: false,
    });
    expect(distance.getSnapshot().position?.coordinate[0]).toBeCloseTo(
      skippedDistanceLongitude ?? 0,
    );
  });

  it("rebases live duration and stop-setting changes through the cursor", () => {
    const fake = fakeClock();
    const engine = createRouteAnimationEngine(
      stopTrack(),
      { ...defaultSettings, playbackMode: "recorded", targetDurationSec: 10 },
      fake.clock,
    );
    engine.play();
    fake.step(0);
    fake.step(5_000);
    const coordinate = engine.getSnapshot().position?.coordinate;
    const originalElapsedMs = engine.getSnapshot().position?.originalElapsedMs;

    engine.configure({
      playbackMode: "recorded",
      targetDurationSec: 20,
      skipDetectedStops: true,
    });

    expect(engine.getSnapshot()).toMatchObject({
      state: "playing",
      skipDetectedStops: true,
      position: { coordinate, originalElapsedMs },
    });
    fake.step(0);
    fake.step(1_000);
    expect(engine.getSnapshot().playbackProgress).toBeGreaterThan(0);
  });
});
