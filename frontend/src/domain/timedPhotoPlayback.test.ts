import { describe, expect, it } from "vitest";
import {
  createRouteAnimationEngine,
  type AnimationFrameClock,
  type RouteAnimationEngine,
  type RoutePlaybackMode,
} from "./routeAnimation";
import { planTimedPhotoEvents } from "./timedPhotoEvents";
import {
  AUTOMATIC_PHOTO_VISIBLE_MS,
  createTimedPhotoPlaybackCoordinator,
  type AutomaticPhotoPresentation,
  type PhotoTimerClock,
} from "./timedPhotoPlayback";
import { buildRouteTrack, type TimedTrack } from "./timedTrack";

function timedTrack(times = [
  "2026-01-01T00:00:00Z",
  "2026-01-01T00:00:10Z",
  "2026-01-01T00:00:20Z",
]): TimedTrack {
  const track = buildRouteTrack({
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
        properties: { coordinate_times: times },
      },
    ],
  });
  if (track.kind !== "timed") throw new Error("Expected a timed track");
  return track;
}

function fakeFrameClock() {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, (timestamp: number) => void>();
  const clock: AnimationFrameClock = {
    requestFrame: (callback) => {
      const id = nextId++;
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

function fakeTimerClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const clock: PhotoTimerClock = {
    setTimeout: (callback, delayMs) => {
      const id = nextId++;
      timers.set(id, { at: now + delayMs, callback });
      return id;
    },
    clearTimeout: (timerId) => timers.delete(timerId as number),
  };
  return {
    clock,
    get pendingCount() {
      return timers.size;
    },
    step(milliseconds: number) {
      now += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

function presenterSpy() {
  const opened: AutomaticPhotoPresentation[] = [];
  const closed: number[] = [];
  return {
    opened,
    closed,
    presenter: {
      open: (presentation: AutomaticPhotoPresentation) =>
        opened.push(presentation),
      close: (photoId: number) => closed.push(photoId),
    },
  };
}

function setup(
  takenAt: string,
  playbackMode: RoutePlaybackMode = "recorded",
  enabled = true,
  track = timedTrack(),
) {
  const frames = fakeFrameClock();
  const timers = fakeTimerClock();
  const presentation = presenterSpy();
  const engine = createRouteAnimationEngine(
    track,
    { playbackMode, targetDurationSec: 10, skipDetectedStops: false },
    frames.clock,
  );
  const events = planTimedPhotoEvents(track, [{ id: 7, takenAt }]);
  const coordinator = createTimedPhotoPlaybackCoordinator({
    track,
    events,
    engine,
    presenter: presentation.presenter,
    enabled,
    timerClock: timers.clock,
  });
  return { engine, frames, timers, presentation, coordinator };
}

function finishLoadedPhoto(
  engine: RouteAnimationEngine,
  timers: ReturnType<typeof fakeTimerClock>,
  presentation: ReturnType<typeof presenterSpy>,
) {
  presentation.opened[0]!.onLoad();
  expect(timers.pendingCount).toBe(1);
  timers.step(AUTOMATIC_PHOTO_VISIBLE_MS - 1);
  expect(engine.getSnapshot().state).toBe("paused");
  timers.step(1);
}

describe("timed photo playback coordinator", () => {
  it.each(["recorded", "distance"] as const)(
    "pauses at the exact event cursor in %s mode and resumes after two loaded seconds",
    (playbackMode) => {
      const { engine, frames, timers, presentation, coordinator } = setup(
        "2026-01-01T00:00:10Z",
        playbackMode,
      );

      engine.play();
      frames.step(0);
      frames.step(6_000);

      expect(engine.getSnapshot()).toMatchObject({
        state: "paused",
        position: { coordinate: [0.001, 0] },
        activePauseReasons: ["photo"],
      });
      expect(presentation.opened.map(({ photoId }) => photoId)).toEqual([7]);
      expect(timers.pendingCount).toBe(0);

      finishLoadedPhoto(engine, timers, presentation);

      expect(presentation.closed).toEqual([7]);
      expect(engine.getSnapshot().state).toBe("playing");
      coordinator.destroy();
    },
  );

  it("shows a start event before the first movement frame", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );

    engine.play();

    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      playbackProgress: 0,
      position: { coordinate: [0, 0] },
    });
    expect(presentation.opened).toHaveLength(1);
    coordinator.destroy();
  });

  it("shows an end event before the engine completes", () => {
    const { engine, frames, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:20Z",
    );

    engine.play();
    frames.step(0);
    frames.step(10_000);

    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      playbackProgress: 1,
      position: { coordinate: [0.003, 0] },
    });
    finishLoadedPhoto(engine, timers, presentation);
    frames.step(0);
    expect(engine.getSnapshot().state).toBe("completed");
    coordinator.destroy();
  });

  it("can intercept an event on an instantaneous route", () => {
    const track = timedTrack([
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]);
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
      "recorded",
      true,
      track,
    );

    engine.play();

    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      position: { coordinate: [0.003, 0] },
    });
    expect(presentation.opened).toHaveLength(1);
    coordinator.destroy();
  });

  it("does not release another composed pause when the photo finishes", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    const releaseHidden = engine.acquirePause("document-hidden");
    expect(engine.getSnapshot().state).toBe("paused");

    finishLoadedPhoto(engine, timers, presentation);

    expect(engine.getSnapshot().state).toBe("paused");
    releaseHidden();
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("cleans up on stop and makes the event available on replay", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();

    engine.stop();

    expect(presentation.closed).toEqual([7]);
    expect(engine.getSnapshot().state).toBe("idle");
    engine.play();
    expect(presentation.opened).toHaveLength(2);
    coordinator.destroy();
  });

  it("consumes past events while timed photos are disabled", () => {
    const { engine, frames, presentation, coordinator } = setup(
      "2026-01-01T00:00:10Z",
      "recorded",
      false,
    );
    engine.play();
    frames.step(0);
    frames.step(6_000);

    coordinator.setEnabled(true);

    expect(presentation.opened).toHaveLength(0);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });
});
