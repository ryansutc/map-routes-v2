import { describe, expect, it } from "vitest";
import {
  createRouteAnimationEngine,
  type AnimationFrameClock,
  type RouteAnimationEngine,
  type RoutePlaybackMode,
} from "./routeAnimation";
import {
  planTimedPhotoEvents as planEvents,
  type TimedPhotoInput,
} from "./timedPhotoEvents";
import {
  AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS,
  AUTOMATIC_PHOTO_VISIBLE_MS,
  createTimedPhotoPlaybackCoordinator,
  type AnimationPhotoPresentation,
  type AutomaticPhotoPresentation,
  type ManualPhotoPresentation,
  type PhotoPreloadScheduler,
  type PhotoSessionId,
  type PhotoTimerClock,
} from "./timedPhotoPlayback";
import { buildRouteTrack, type TimedTrack } from "./timedTrack";

type LocatedPhotoInput = Omit<TimedPhotoInput, "latitude" | "longitude">;

function planTimedPhotoEvents(
  track: TimedTrack,
  photos: readonly LocatedPhotoInput[],
) {
  return planEvents(
    track,
    photos.map((photo) => ({
      ...photo,
      latitude: 49.3,
      longitude: -122.5,
    })),
  );
}

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
    now: () => now,
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

function fakePreloadScheduler() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  const scheduler: PhotoPreloadScheduler = {
    schedule: (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return () => callbacks.delete(id);
    },
  };
  return {
    scheduler,
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

function presenterSpy() {
  const opened: AutomaticPhotoPresentation[] = [];
  const manualOpened: ManualPhotoPresentation[] = [];
  const closed: PhotoSessionId[] = [];
  const preloaded: number[][] = [];
  return {
    opened,
    manualOpened,
    closed,
    preloaded,
    presenter: {
      open: (presentation: AnimationPhotoPresentation) => {
        if (presentation.kind === "automatic") opened.push(presentation);
        else manualOpened.push(presentation);
      },
      close: (sessionId: PhotoSessionId) => closed.push(sessionId),
      preload: (photoIds: readonly number[]) => preloaded.push([...photoIds]),
    },
  };
}

function mapAnchorWithVisiblePhotos(visiblePhotoIds: readonly number[]) {
  const visible = new Set(visiblePhotoIds);
  return {
    getSnapshot: (photoId: number) =>
      visible.has(photoId)
        ? {
            x: 100,
            y: 100,
            viewportWidth: 800,
            viewportHeight: 600,
            visible: true,
          }
        : null,
    subscribe: () => () => {},
  };
}

function setup(
  takenAt: string,
  playbackMode: RoutePlaybackMode = "recorded",
  enabled = true,
  track = timedTrack(),
) {
  return setupPhotos(
    [{ id: 7, takenAt }],
    playbackMode,
    enabled,
    track,
  );
}

function setupPhotos(
  photos: readonly LocatedPhotoInput[],
  playbackMode: RoutePlaybackMode = "recorded",
  enabled = true,
  track = timedTrack(),
  visiblePhotoIds = photos.map((photo) => photo.id),
) {
  const frames = fakeFrameClock();
  const timers = fakeTimerClock();
  const preloads = fakePreloadScheduler();
  const presentation = presenterSpy();
  const engine = createRouteAnimationEngine(
    track,
    { playbackMode, targetDurationSec: 10, skipDetectedStops: false },
    frames.clock,
  );
  const events = planTimedPhotoEvents(track, photos);
  const coordinator = createTimedPhotoPlaybackCoordinator({
    track,
    events,
    engine,
    presenter: presentation.presenter,
    enabled,
    groupingSettings: {
      playbackMode,
      skipDetectedStops: false,
      targetDurationSec: 10,
    },
    timerClock: timers.clock,
    preloadScheduler: preloads.scheduler,
    mapAnchor: mapAnchorWithVisiblePhotos(visiblePhotoIds),
  });
  return { engine, frames, timers, preloads, presentation, coordinator };
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
      expect(timers.pendingCount).toBe(1);

      finishLoadedPhoto(engine, timers, presentation);

      expect(presentation.closed).toHaveLength(1);
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
    const releaseManual = engine.acquirePause("manual-gallery");
    expect(engine.getSnapshot().state).toBe("paused");

    finishLoadedPhoto(engine, timers, presentation);

    expect(engine.getSnapshot().state).toBe("paused");
    releaseManual();
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("cleans up on stop and makes the event available on replay", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();

    engine.stop();

    expect(presentation.closed).toHaveLength(1);
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

  it("shows a group in order and moves the marker to every photo cursor", () => {
    const track = timedTrack();
    const frames = fakeFrameClock();
    const timers = fakeTimerClock();
    const preloads = fakePreloadScheduler();
    const presentation = presenterSpy();
    const engine = createRouteAnimationEngine(
      track,
      { playbackMode: "recorded", targetDurationSec: 20, skipDetectedStops: false },
      frames.clock,
    );
    const events = planTimedPhotoEvents(track, [
      { id: 3, takenAt: "2026-01-01T00:00:12Z" },
      { id: 1, takenAt: "2026-01-01T00:00:10Z" },
      { id: 2, takenAt: "2026-01-01T00:00:11Z" },
    ]);
    const coordinator = createTimedPhotoPlaybackCoordinator({
      track,
      events,
      engine,
      presenter: presentation.presenter,
      enabled: true,
      groupingSettings: {
        playbackMode: "recorded",
        skipDetectedStops: false,
        targetDurationSec: 20,
      },
      timerClock: timers.clock,
      preloadScheduler: preloads.scheduler,
      mapAnchor: mapAnchorWithVisiblePhotos([1, 2, 3]),
    });

    engine.play();
    frames.step(0);
    frames.step(10_000);
    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1]);

    presentation.opened[0]!.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);
    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1, 2]);
    expect(engine.getSnapshot().position?.originalElapsedMs).toBe(11_000);

    presentation.opened[1]!.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);
    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1, 2, 3]);
    expect(engine.getSnapshot().position?.originalElapsedMs).toBe(12_000);

    presentation.opened[2]!.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);
    expect(engine.getSnapshot().state).toBe("playing");
    expect(presentation.closed).toHaveLength(1);
    coordinator.destroy();
  });

  it("skips failed and timed-out images without deadlocking the group", () => {
    const track = timedTrack();
    const frames = fakeFrameClock();
    const timers = fakeTimerClock();
    const preloads = fakePreloadScheduler();
    const presentation = presenterSpy();
    const engine = createRouteAnimationEngine(
      track,
      { playbackMode: "recorded", targetDurationSec: 20, skipDetectedStops: false },
      frames.clock,
    );
    const events = planTimedPhotoEvents(track, [
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:00:01Z" },
      { id: 3, takenAt: "2026-01-01T00:00:02Z" },
    ]);
    const coordinator = createTimedPhotoPlaybackCoordinator({
      track,
      events,
      engine,
      presenter: presentation.presenter,
      enabled: true,
      groupingSettings: {
        playbackMode: "recorded",
        skipDetectedStops: false,
        targetDurationSec: 20,
      },
      timerClock: timers.clock,
      preloadScheduler: preloads.scheduler,
      mapAnchor: mapAnchorWithVisiblePhotos([1, 2, 3]),
    });

    engine.play();
    presentation.opened[0]!.onError();
    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1, 2]);

    timers.step(AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS);
    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1, 2, 3]);

    presentation.opened[2]!.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);
    expect(engine.getSnapshot().state).toBe("playing");
    expect(timers.pendingCount).toBe(0);
    coordinator.destroy();
  });

  it("opportunistically preloads one upcoming group at a time", () => {
    const track = timedTrack();
    const frames = fakeFrameClock();
    const timers = fakeTimerClock();
    const preloads = fakePreloadScheduler();
    const presentation = presenterSpy();
    const engine = createRouteAnimationEngine(
      track,
      { playbackMode: "recorded", targetDurationSec: 10, skipDetectedStops: false },
      frames.clock,
    );
    const events = planTimedPhotoEvents(track, [
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:00:05Z" },
      { id: 3, takenAt: "2026-01-01T00:00:20Z" },
    ]);
    const coordinator = createTimedPhotoPlaybackCoordinator({
      track,
      events,
      engine,
      presenter: presentation.presenter,
      enabled: true,
      groupingSettings: {
        playbackMode: "recorded",
        skipDetectedStops: false,
        targetDurationSec: 10,
      },
      timerClock: timers.clock,
      preloadScheduler: preloads.scheduler,
      mapAnchor: mapAnchorWithVisiblePhotos([1, 2, 3]),
    });

    preloads.flush();
    engine.play();
    preloads.flush();

    expect(presentation.preloaded).toEqual([[1], [2]]);
    expect(presentation.preloaded.flat()).not.toContain(3);
    coordinator.destroy();
  });

  it("reschedules a canceled preload when timed photos are re-enabled", () => {
    const { engine, preloads, presentation, coordinator } = setup(
      "2026-01-01T00:00:10Z",
    );
    engine.play();

    coordinator.setEnabled(false);
    coordinator.setEnabled(true);
    preloads.flush();

    expect(presentation.preloaded).toEqual([[7]]);
    coordinator.destroy();
  });

  it("manual close consumes the rest of an automatic group", () => {
    const { engine, frames, presentation, coordinator } = setupPhotos([
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:00:01Z" },
      { id: 3, takenAt: "2026-01-01T00:00:02Z" },
    ]);
    engine.play();

    presentation.opened[0]!.onDismiss();
    frames.step(10_000);

    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([1]);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("skips off-screen events in a mixed group and shows only visible photos", () => {
    const { engine, timers, presentation, coordinator } = setupPhotos(
      [
        { id: 1, takenAt: "2026-01-01T00:00:00Z" },
        { id: 2, takenAt: "2026-01-01T00:00:01Z" },
        { id: 3, takenAt: "2026-01-01T00:00:02Z" },
      ],
      "recorded",
      true,
      timedTrack(),
      [2],
    );

    engine.play();

    expect(presentation.opened.map((photo) => photo.photoId)).toEqual([2]);
    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      position: { originalElapsedMs: 1_000 },
    });
    finishLoadedPhoto(engine, timers, presentation);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("consumes an entirely off-screen group without visibly pausing", () => {
    const { engine, presentation, coordinator } = setupPhotos(
      [
        { id: 1, takenAt: "2026-01-01T00:00:00Z" },
        { id: 2, takenAt: "2026-01-01T00:00:01Z" },
      ],
      "recorded",
      true,
      timedTrack(),
      [],
    );

    engine.play();

    expect(presentation.opened).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({
      state: "playing",
      activePauseReasons: [],
    });
    coordinator.destroy();
  });

  it("transfers automatic navigation to full-gallery manual control", () => {
    const { engine, timers, presentation, coordinator } = setupPhotos([
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:00:01Z" },
    ]);
    engine.play();
    const automatic = presentation.opened[0]!;

    automatic.onNavigate(42);
    automatic.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);

    expect(presentation.manualOpened.map((photo) => photo.photoId)).toEqual([
      42,
    ]);
    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      activePauseReasons: ["manual-gallery"],
    });
    expect(presentation.opened).toHaveLength(1);

    presentation.manualOpened[0]!.onDismiss();
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("pauses for manually opened photos only during an active session", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:10Z",
    );

    expect(coordinator.openManualPhoto(42)).toBe(false);
    engine.play();
    expect(coordinator.openManualPhoto(42)).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      activePauseReasons: ["manual-gallery"],
    });

    presentation.manualOpened[0]!.onDismiss();
    expect(engine.getSnapshot().state).toBe("playing");
    engine.stop();
    expect(coordinator.openManualPhoto(42)).toBe(false);
    expect(engine.getSnapshot().state).toBe("idle");
    coordinator.destroy();
  });

  it("replaces an active automatic session when a photo is opened manually", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    const automatic = presentation.opened[0]!;

    expect(coordinator.openManualPhoto(42)).toBe(true);
    automatic.onLoad();
    timers.step(AUTOMATIC_PHOTO_VISIBLE_MS);

    expect(presentation.manualOpened.map((photo) => photo.photoId)).toEqual([
      42,
    ]);
    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      activePauseReasons: ["manual-gallery"],
    });
    presentation.manualOpened[0]!.onDismiss();
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("keeps composed pauses when a manual gallery closes", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:10Z",
    );
    engine.play();
    const releaseHidden = engine.acquirePause("document-hidden");
    coordinator.openManualPhoto(42);

    presentation.manualOpened[0]!.onDismiss();

    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      activePauseReasons: ["document-hidden"],
    });
    releaseHidden();
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("offers explicit stop after an automatic popup expands to the manual lightbox", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    presentation.opened[0]!.onNavigate(42);
    presentation.manualOpened[0]!.onStop();

    expect(engine.getSnapshot()).toMatchObject({
      state: "idle",
      playbackProgress: 0,
    });
    expect(presentation.closed).toHaveLength(1);
    coordinator.destroy();
  });

  it("pauses photo loading and visible time while the document is hidden", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    presentation.opened[0]!.onLoad();
    timers.step(1_000);
    const releaseHidden = engine.acquirePause("document-hidden");

    timers.step(10_000);
    expect(presentation.closed).toHaveLength(0);

    releaseHidden();
    timers.step(999);
    expect(presentation.closed).toHaveLength(0);
    timers.step(1);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("preserves remaining visible time while popup interaction suspends it", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    presentation.opened[0]!.onLoad();
    timers.step(800);

    presentation.opened[0]!.onTimerPauseChange(true);
    timers.step(5_000);
    expect(engine.getSnapshot().state).toBe("paused");

    presentation.opened[0]!.onTimerPauseChange(false);
    timers.step(1_199);
    expect(engine.getSnapshot().state).toBe("paused");
    timers.step(1);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("keeps the bounded image-load timeout running during popup interaction", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();

    presentation.opened[0]!.onTimerPauseChange(true);
    timers.step(AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS);

    expect(presentation.closed).toHaveLength(1);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("pauses the bounded image-load timeout while the document is hidden", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    const releaseHidden = engine.acquirePause("document-hidden");

    timers.step(AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS * 2);
    expect(presentation.closed).toHaveLength(0);

    releaseHidden();
    timers.step(AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS - 1);
    expect(presentation.closed).toHaveLength(0);
    timers.step(1);
    expect(presentation.closed).toHaveLength(1);
    expect(engine.getSnapshot().state).toBe("playing");
    coordinator.destroy();
  });

  it("ignores stale automatic callbacks from an earlier playback session", () => {
    const { engine, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    const stale = presentation.opened[0]!;
    engine.stop();
    engine.play();

    stale.onLoad();
    stale.onDismiss();
    stale.onNavigate(42);

    expect(presentation.opened).toHaveLength(2);
    expect(presentation.manualOpened).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({
      state: "paused",
      activePauseReasons: ["photo"],
    });
    coordinator.destroy();
  });

  it("cancels session work and ignores callbacks after destroy", () => {
    const { engine, timers, presentation, coordinator } = setup(
      "2026-01-01T00:00:00Z",
    );
    engine.play();
    const stale = presentation.opened[0]!;

    coordinator.destroy();
    stale.onLoad();
    stale.onDismiss();
    stale.onNavigate(42);
    timers.step(AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS);

    expect(engine.getSnapshot().state).toBe("playing");
    expect(presentation.manualOpened).toHaveLength(0);
    expect(presentation.closed).toHaveLength(1);
  });
});
