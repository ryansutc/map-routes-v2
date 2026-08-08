import type {
  RouteTrack,
  TrackCoordinate,
  TrackCursor,
  TrackProfilePoint,
} from "./timedTrack";

export const TARGET_ROUTE_DURATIONS_SEC = [10, 20, 30, 60, 120] as const;
export const DEFAULT_TARGET_ROUTE_DURATION_SEC = 20;

export type TargetRouteDurationSec =
  (typeof TARGET_ROUTE_DURATIONS_SEC)[number];
export type RoutePlaybackMode = "recorded" | "indexed" | "distance";
export type AnimationLifecycleState =
  | "idle"
  | "playing"
  | "paused"
  | "completed";
export type AnimationPauseReason =
  | "document-hidden"
  | "photo"
  | "manual-gallery";

export type AnimationPosition = {
  coordinate: TrackCoordinate;
  pointIndex: number;
  originalElapsedMs: number | null;
  cumulativeDistanceM: number;
};

export type RouteAnimationSnapshot = {
  state: AnimationLifecycleState;
  playbackMode: RoutePlaybackMode;
  skipDetectedStops: boolean;
  playbackProgress: number;
  distanceProgress: number;
  position: AnimationPosition | null;
  activePauseReasons: readonly AnimationPauseReason[];
};

export type RouteAnimationSettings = {
  playbackMode: RoutePlaybackMode;
  targetDurationSec: TargetRouteDurationSec;
  skipDetectedStops: boolean;
};

export type AnimationFrameClock = {
  requestFrame: (callback: (timestamp: number) => void) => number;
  cancelFrame: (requestId: number) => void;
};

export type RouteAnimationEngine = {
  getSnapshot: () => RouteAnimationSnapshot;
  subscribe: (listener: () => void) => () => void;
  subscribeToFrames: (
    listener: (snapshot: RouteAnimationSnapshot) => void,
  ) => () => void;
  play: () => void;
  stop: () => void;
  acquirePause: (reason: AnimationPauseReason) => () => void;
  configure: (settings: RouteAnimationSettings) => void;
  destroy: () => void;
};

const UI_UPDATE_INTERVAL_MS = 50;
const UI_PROGRESS_THRESHOLD = 0.005;

export function isTargetRouteDuration(
  value: unknown,
): value is TargetRouteDurationSec {
  return TARGET_ROUTE_DURATIONS_SEC.includes(value as TargetRouteDurationSec);
}

export function isRoutePlaybackMode(
  value: unknown,
): value is RoutePlaybackMode {
  return value === "recorded" || value === "indexed" || value === "distance";
}

export function availablePlaybackModes(
  track: RouteTrack,
): readonly RoutePlaybackMode[] {
  return track.kind === "timed"
    ? ["recorded", "distance"]
    : ["indexed", "distance"];
}

export function resolvePlaybackMode(
  track: RouteTrack,
  preferredMode: RoutePlaybackMode,
): RoutePlaybackMode {
  if (track.kind === "timed") {
    return preferredMode === "distance" ? "distance" : "recorded";
  }
  return preferredMode === "distance" ? "distance" : "indexed";
}

export function isAnimationSessionActive(
  state: AnimationLifecycleState,
): boolean {
  return state === "playing" || state === "paused";
}

function upperBound<T>(
  values: readonly T[],
  target: number,
  select: (value: T) => number,
): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (select(values[middle]!) <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function coordinateAtProfilePoint(point: TrackProfilePoint): TrackCoordinate {
  return point.elevation === 0
    ? [point.lon, point.lat]
    : [point.lon, point.lat, point.elevation];
}

function positionAtProfilePoint(point: TrackProfilePoint): AnimationPosition {
  return {
    coordinate: coordinateAtProfilePoint(point),
    pointIndex: point.pointIndex,
    originalElapsedMs: null,
    cumulativeDistanceM: point.distance,
  };
}

function positionAtTimedCursor(cursor: TrackCursor): AnimationPosition {
  return {
    coordinate: cursor.coordinate,
    pointIndex: cursor.pointIndex,
    originalElapsedMs: cursor.originalElapsedMs,
    cumulativeDistanceM: cursor.cumulativeDistanceM,
  };
}

function positionAtLegacyDistance(
  points: readonly TrackProfilePoint[],
  requestedDistanceM: number,
): AnimationPosition | null {
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return null;

  const distanceM = Math.min(
    lastPoint.distance,
    Math.max(0, requestedDistanceM),
  );
  if (distanceM <= 0) return positionAtProfilePoint(firstPoint);
  if (distanceM >= lastPoint.distance) return positionAtProfilePoint(lastPoint);

  const pointIndex =
    upperBound(points, distanceM, (point) => point.distance) - 1;
  const first = points[Math.max(0, pointIndex)]!;
  const second = points[first.pointIndex + 1];
  if (!second || second.segmentIndex !== first.segmentIndex) {
    return positionAtProfilePoint(first);
  }

  const span = second.distance - first.distance;
  if (span <= 0) return positionAtProfilePoint(second);
  const fraction = (distanceM - first.distance) / span;
  const firstCoordinate = coordinateAtProfilePoint(first);
  const secondCoordinate = coordinateAtProfilePoint(second);
  const firstElevation = firstCoordinate[2] ?? secondCoordinate[2] ?? 0;
  const secondElevation = secondCoordinate[2] ?? firstCoordinate[2] ?? 0;
  const hasElevation =
    firstCoordinate[2] !== undefined || secondCoordinate[2] !== undefined;
  const coordinate: TrackCoordinate = hasElevation
    ? [
        first.lon + (second.lon - first.lon) * fraction,
        first.lat + (second.lat - first.lat) * fraction,
        firstElevation + (secondElevation - firstElevation) * fraction,
      ]
    : [
        first.lon + (second.lon - first.lon) * fraction,
        first.lat + (second.lat - first.lat) * fraction,
      ];

  return {
    coordinate,
    pointIndex: first.pointIndex,
    originalElapsedMs: null,
    cumulativeDistanceM: distanceM,
  };
}

type PlaybackProjection = {
  positionAt: (progress: number) => AnimationPosition | null;
  progressAt: (position: AnimationPosition | null) => number;
  isInstantaneous: boolean;
};

function playbackProjection(
  track: RouteTrack,
  mode: RoutePlaybackMode,
  skipDetectedStops: boolean,
): PlaybackProjection {
  const clamp = (progress: number) => Math.min(1, Math.max(0, progress));

  if (mode === "recorded" && track.kind === "timed") {
    const timelineDurationMs = skipDetectedStops
      ? track.movingDurationMs
      : track.originalDurationMs;
    return {
      positionAt: (progress) =>
        positionAtTimedCursor(
          skipDetectedStops
            ? track.atMovingElapsed(timelineDurationMs * clamp(progress))
            : track.atOriginalElapsed(timelineDurationMs * clamp(progress)),
        ),
      progressAt: (position) => {
        if (!position) return 0;
        if (timelineDurationMs <= 0 || position.originalElapsedMs === null)
          return 1;
        const elapsedMs = skipDetectedStops
          ? track.atOriginalElapsed(position.originalElapsedMs).movingElapsedMs
          : position.originalElapsedMs;
        return elapsedMs / timelineDurationMs;
      },
      isInstantaneous: timelineDurationMs === 0,
    };
  }

  if (mode === "distance") {
    return {
      positionAt: (progress) => {
        const distanceM = track.totalDistanceM * clamp(progress);
        return track.kind === "timed"
          ? positionAtTimedCursor(track.atDistance(distanceM))
          : positionAtLegacyDistance(track.profilePoints, distanceM);
      },
      progressAt: (position) => {
        if (!position) return 0;
        return track.totalDistanceM > 0
          ? position.cumulativeDistanceM / track.totalDistanceM
          : 1;
      },
      isInstantaneous: false,
    };
  }

  return {
    positionAt: (progress) => {
      const pointIndex = Math.floor(
        clamp(progress) * Math.max(0, track.profilePoints.length - 1),
      );
      const point = track.profilePoints[pointIndex];
      return point ? positionAtProfilePoint(point) : null;
    },
    progressAt: (position) => {
      if (!position) return 0;
      return track.profilePoints.length > 1
        ? position.pointIndex / (track.profilePoints.length - 1)
        : 1;
    },
    isInstantaneous: false,
  };
}

function distanceProgress(
  track: RouteTrack,
  position: AnimationPosition | null,
): number {
  if (!position) return 0;
  if (track.totalDistanceM <= 0) {
    return position.pointIndex >= track.profilePoints.length - 1 ? 1 : 0;
  }
  return Math.min(1, position.cumulativeDistanceM / track.totalDistanceM);
}

function browserAnimationClock(): AnimationFrameClock {
  return {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (requestId) => cancelAnimationFrame(requestId),
  };
}

export function createRouteAnimationEngine(
  track: RouteTrack,
  initialSettings: RouteAnimationSettings,
  clock: AnimationFrameClock = browserAnimationClock(),
): RouteAnimationEngine {
  let settings = {
    ...initialSettings,
    playbackMode: resolvePlaybackMode(track, initialSettings.playbackMode),
  };
  let projection = playbackProjection(
    track,
    settings.playbackMode,
    settings.skipDetectedStops,
  );
  let state: AnimationLifecycleState = "idle";
  let playbackProgress = 0;
  let elapsedPlaybackMs = 0;
  let lastFrameAt: number | null = null;
  let frameRequestId: number | null = null;
  let destroyed = false;
  let lastUiUpdateAt = 0;
  let lastUiProgress = 0;
  let rebasedPosition: AnimationPosition | null = null;
  const pauseLeases = new Map<AnimationPauseReason, Set<symbol>>();
  const listeners = new Set<() => void>();
  const frameListeners = new Set<(snapshot: RouteAnimationSnapshot) => void>();

  let snapshot: RouteAnimationSnapshot = {
    state,
    playbackMode: settings.playbackMode,
    skipDetectedStops: settings.skipDetectedStops,
    playbackProgress,
    distanceProgress: 0,
    position: projection.positionAt(0),
    activePauseReasons: [],
  };

  const updateSnapshot = () => {
    const position = rebasedPosition ?? projection.positionAt(playbackProgress);
    snapshot = {
      state,
      playbackMode: settings.playbackMode,
      skipDetectedStops: settings.skipDetectedStops,
      playbackProgress,
      distanceProgress: distanceProgress(track, position),
      position,
      activePauseReasons: [...pauseLeases.keys()],
    };
  };

  const emitUi = () => listeners.forEach((listener) => listener());
  const emitFrame = () =>
    frameListeners.forEach((listener) => listener(snapshot));

  const cancelScheduledFrame = () => {
    if (frameRequestId === null) return;
    clock.cancelFrame(frameRequestId);
    frameRequestId = null;
  };

  const routeDurationMs = () => settings.targetDurationSec * 1000;

  const frame = (timestamp: number) => {
    frameRequestId = null;
    if (destroyed || state !== "playing") return;
    if (lastFrameAt === null) lastFrameAt = timestamp;
    const deltaMs = Math.max(0, timestamp - lastFrameAt);
    lastFrameAt = timestamp;
    elapsedPlaybackMs += deltaMs;
    if (deltaMs > 0) rebasedPosition = null;
    playbackProgress = Math.min(1, elapsedPlaybackMs / routeDurationMs());
    if (playbackProgress >= 1) state = "completed";
    updateSnapshot();
    emitFrame();

    const uiElapsed = timestamp - lastUiUpdateAt;
    const uiProgressDelta = Math.abs(playbackProgress - lastUiProgress);
    if (
      state === "completed" ||
      uiElapsed >= UI_UPDATE_INTERVAL_MS ||
      uiProgressDelta >= UI_PROGRESS_THRESHOLD
    ) {
      lastUiUpdateAt = timestamp;
      lastUiProgress = playbackProgress;
      emitUi();
    }

    if (state === "playing") {
      frameRequestId = clock.requestFrame(frame);
    }
  };

  const scheduleFrame = () => {
    if (frameRequestId === null && state === "playing") {
      frameRequestId = clock.requestFrame(frame);
    }
  };

  const forcePublish = () => {
    updateSnapshot();
    emitFrame();
    emitUi();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeToFrames: (listener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    play: () => {
      if (destroyed || state === "playing") return;
      if (track.profilePoints.length < 2) return;
      if (state === "completed") {
        playbackProgress = 0;
        elapsedPlaybackMs = 0;
        rebasedPosition = null;
      }
      if (projection.isInstantaneous) {
        playbackProgress = 1;
        elapsedPlaybackMs = routeDurationMs();
        state = "completed";
        forcePublish();
        return;
      }
      lastFrameAt = null;
      state = pauseLeases.size > 0 ? "paused" : "playing";
      forcePublish();
      scheduleFrame();
    },
    stop: () => {
      if (destroyed) return;
      cancelScheduledFrame();
      for (const reason of pauseLeases.keys()) {
        if (reason !== "document-hidden") pauseLeases.delete(reason);
      }
      state = "idle";
      playbackProgress = 0;
      elapsedPlaybackMs = 0;
      rebasedPosition = null;
      lastFrameAt = null;
      lastUiProgress = 0;
      forcePublish();
    },
    acquirePause: (reason) => {
      if (destroyed) return () => {};
      const token = Symbol(reason);
      const leases = pauseLeases.get(reason) ?? new Set<symbol>();
      leases.add(token);
      pauseLeases.set(reason, leases);
      if (state === "playing") {
        cancelScheduledFrame();
        state = "paused";
        lastFrameAt = null;
      }
      forcePublish();

      let released = false;
      return () => {
        if (destroyed || released) return;
        released = true;
        const activeLeases = pauseLeases.get(reason);
        if (!activeLeases?.delete(token)) return;
        if (activeLeases.size === 0) pauseLeases.delete(reason);
        if (state === "paused" && pauseLeases.size === 0) {
          state = "playing";
          lastFrameAt = null;
        }
        forcePublish();
        scheduleFrame();
      };
    },
    configure: (nextSettings) => {
      if (destroyed) return;
      const position = snapshot.position;
      const nextMode = resolvePlaybackMode(track, nextSettings.playbackMode);
      settings = { ...nextSettings, playbackMode: nextMode };
      projection = playbackProjection(
        track,
        nextMode,
        nextSettings.skipDetectedStops,
      );
      playbackProgress = projection.progressAt(position);
      elapsedPlaybackMs = playbackProgress * routeDurationMs();
      if ((state === "playing" || state === "paused") && position) {
        rebasedPosition = position;
      } else {
        rebasedPosition = null;
      }
      lastFrameAt = null;
      forcePublish();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      cancelScheduledFrame();
      listeners.clear();
      frameListeners.clear();
    },
  };
}
