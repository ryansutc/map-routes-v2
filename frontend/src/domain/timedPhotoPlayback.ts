import type {
  RouteAnimationEngine,
  RouteAnimationSnapshot,
} from "./routeAnimation";
import type { TimedPhotoEvent } from "./timedPhotoEvents";
import type { TimedTrack } from "./timedTrack";

export const AUTOMATIC_PHOTO_VISIBLE_MS = 2_000;

export type AutomaticPhotoPresentation = {
  photoId: number;
  onLoad: () => void;
  onDismiss: () => void;
};

export type TimedPhotoPresenter = {
  open: (presentation: AutomaticPhotoPresentation) => void;
  close: (photoId: number) => void;
};

export type PhotoTimerClock = {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timerId: unknown) => void;
};

type PhotoPlaybackEngine = Pick<
  RouteAnimationEngine,
  "getSnapshot" | "subscribeToFrames" | "pauseAtCursor"
>;

type ActivePhoto = {
  event: TimedPhotoEvent;
  token: symbol;
  releasePause: () => void;
  timerId: unknown | null;
};

export type TimedPhotoPlaybackCoordinator = {
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
};

function browserPhotoTimerClock(): PhotoTimerClock {
  return {
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timerId) => window.clearTimeout(timerId as number),
  };
}

function eventProgress(
  track: TimedTrack,
  event: TimedPhotoEvent,
  snapshot: RouteAnimationSnapshot,
) {
  if (snapshot.playbackMode === "distance") {
    return track.totalDistanceM > 0
      ? event.cursor.cumulativeDistanceM / track.totalDistanceM
      : 0;
  }
  const durationMs = snapshot.skipDetectedStops
    ? track.movingDurationMs
    : track.originalDurationMs;
  if (durationMs <= 0) return 0;
  const elapsedMs = snapshot.skipDetectedStops
    ? event.cursor.movingElapsedMs
    : event.cursor.originalElapsedMs;
  return elapsedMs / durationMs;
}

/**
 * Consumes a preplanned event list with one forward cursor per playback run.
 * It owns automatic presentation timing while React only renders the current
 * presentation through the presenter seam.
 */
export function createTimedPhotoPlaybackCoordinator({
  track,
  events,
  engine,
  presenter,
  enabled: initialEnabled,
  timerClock = browserPhotoTimerClock(),
}: {
  track: TimedTrack;
  events: readonly TimedPhotoEvent[];
  engine: PhotoPlaybackEngine;
  presenter: TimedPhotoPresenter;
  enabled: boolean;
  timerClock?: PhotoTimerClock;
}): TimedPhotoPlaybackCoordinator {
  let enabled = initialEnabled;
  let destroyed = false;
  let nextEventIndex = 0;
  let previousState = engine.getSnapshot().state;
  let activePhoto: ActivePhoto | null = null;

  const closeAndRelease = (photo: ActivePhoto) => {
    if (photo.timerId !== null) timerClock.clearTimeout(photo.timerId);
    presenter.close(photo.event.photoId);
    photo.releasePause();
  };

  const finishActivePhoto = (token: symbol) => {
    if (destroyed || activePhoto?.token !== token) return;
    const finishing = activePhoto;
    activePhoto = null;
    closeAndRelease(finishing);
  };

  const cancelActivePhoto = () => {
    if (!activePhoto) return;
    const cancelling = activePhoto;
    activePhoto = null;
    closeAndRelease(cancelling);
  };

  const openEvent = (event: TimedPhotoEvent) => {
    const token = Symbol(`photo-${event.photoId}`);
    activePhoto = {
      event,
      token,
      releasePause: () => {},
      timerId: null,
    };
    const releasePause = engine.pauseAtCursor(event.cursor, "photo");
    if (!activePhoto || activePhoto.token !== token) {
      releasePause();
      return;
    }
    activePhoto.releasePause = releasePause;
    presenter.open({
      photoId: event.photoId,
      onLoad: () => {
        if (
          destroyed ||
          activePhoto?.token !== token ||
          activePhoto.timerId !== null
        ) {
          return;
        }
        activePhoto.timerId = timerClock.setTimeout(
          () => finishActivePhoto(token),
          AUTOMATIC_PHOTO_VISIBLE_MS,
        );
      },
      onDismiss: () => finishActivePhoto(token),
    });
  };

  const onFrame = (snapshot: RouteAnimationSnapshot) => {
    if (destroyed) return;
    const priorState = previousState;
    previousState = snapshot.state;

    if (
      (snapshot.state === "playing" || snapshot.state === "paused") &&
      (priorState === "idle" || priorState === "completed")
    ) {
      nextEventIndex = 0;
    }

    if (snapshot.state === "idle") {
      nextEventIndex = 0;
      cancelActivePhoto();
      return;
    }
    if (snapshot.state !== "playing" || activePhoto) return;

    while (nextEventIndex < events.length) {
      const event = events[nextEventIndex]!;
      if (eventProgress(track, event, snapshot) > snapshot.playbackProgress) {
        return;
      }
      nextEventIndex += 1;
      if (enabled) {
        openEvent(event);
        return;
      }
    }
  };

  const unsubscribe = engine.subscribeToFrames(onFrame);

  return {
    setEnabled: (nextEnabled) => {
      if (destroyed || enabled === nextEnabled) return;
      enabled = nextEnabled;
      if (!enabled) cancelActivePhoto();
      onFrame(engine.getSnapshot());
    },
    destroy: () => {
      if (destroyed) return;
      unsubscribe();
      cancelActivePhoto();
      destroyed = true;
    },
  };
}
