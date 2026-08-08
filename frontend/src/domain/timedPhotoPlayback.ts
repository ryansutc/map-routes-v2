import type {
  RouteAnimationEngine,
  RouteAnimationSnapshot,
} from "./routeAnimation";
import {
  groupTimedPhotoEvents,
  type TimedPhotoEvent,
  type TimedPhotoEventGroup,
} from "./timedPhotoEvents";
import type { TimedTrack } from "./timedTrack";

export const AUTOMATIC_PHOTO_VISIBLE_MS = 2_000;
export const AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS = 10_000;

export type AutomaticPhotoPresentation = {
  photoId: number;
  onLoad: () => void;
  onError: () => void;
  onDismiss: () => void;
};

export type TimedPhotoPresenter = {
  open: (presentation: AutomaticPhotoPresentation) => void;
  close: (photoId: number) => void;
  preload: (photoIds: readonly number[]) => void;
};

export type PhotoTimerClock = {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timerId: unknown) => void;
};

export type PhotoPreloadScheduler = {
  schedule: (callback: () => void) => () => void;
};

type PhotoPlaybackEngine = Pick<
  RouteAnimationEngine,
  "getSnapshot" | "subscribeToFrames" | "pauseAtCursor" | "moveToCursor"
>;

type ActiveGroup = {
  group: TimedPhotoEventGroup;
  eventIndex: number;
  groupToken: symbol;
  photoToken: symbol;
  phase: "loading" | "visible";
  releasePause: () => void;
  timerId: unknown | null;
};

export type TimedPhotoPlaybackCoordinator = {
  setEnabled: (enabled: boolean) => void;
  setGroupingSettings: (settings: TimedPhotoGroupingSettings) => void;
  destroy: () => void;
};

export type TimedPhotoGroupingSettings = Pick<
  RouteAnimationSnapshot,
  "playbackMode" | "skipDetectedStops"
> & {
  targetDurationSec: number;
};

function browserPhotoTimerClock(): PhotoTimerClock {
  return {
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timerId) => window.clearTimeout(timerId as number),
  };
}

function browserPhotoPreloadScheduler(): PhotoPreloadScheduler {
  return {
    schedule: (callback) => {
      const timerId = window.setTimeout(callback, 0);
      return () => window.clearTimeout(timerId);
    },
  };
}

function eventProgress(
  track: TimedTrack,
  event: TimedPhotoEvent,
  settings: Pick<
    RouteAnimationSnapshot,
    "playbackMode" | "skipDetectedStops"
  >,
) {
  if (settings.playbackMode === "distance") {
    return track.totalDistanceM > 0
      ? event.cursor.cumulativeDistanceM / track.totalDistanceM
      : 0;
  }
  const durationMs = settings.skipDetectedStops
    ? track.movingDurationMs
    : track.originalDurationMs;
  if (durationMs <= 0) return 0;
  const elapsedMs = settings.skipDetectedStops
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
  groupingSettings: initialGroupingSettings,
  timerClock = browserPhotoTimerClock(),
  preloadScheduler = browserPhotoPreloadScheduler(),
}: {
  track: TimedTrack;
  events: readonly TimedPhotoEvent[];
  engine: PhotoPlaybackEngine;
  presenter: TimedPhotoPresenter;
  enabled: boolean;
  groupingSettings: TimedPhotoGroupingSettings;
  timerClock?: PhotoTimerClock;
  preloadScheduler?: PhotoPreloadScheduler;
}): TimedPhotoPlaybackCoordinator {
  let enabled = initialEnabled;
  let groupingSettings = initialGroupingSettings;
  let destroyed = false;
  let nextEventIndex = 0;
  let previousState = engine.getSnapshot().state;
  let activeGroup: ActiveGroup | null = null;
  let preloadedGroupFirstPhotoId: number | null = null;
  let fullGroupPlan: readonly TimedPhotoEventGroup[] = [];
  let plannedGroups: readonly TimedPhotoEventGroup[] = [];
  let plannedGroupIndex = 0;
  let cancelScheduledPreload: (() => void) | null = null;

  const currentEvent = (group: ActiveGroup) =>
    group.group.events[group.eventIndex]!;

  const clearGroupTimer = (group: ActiveGroup) => {
    if (group.timerId === null) return;
    timerClock.clearTimeout(group.timerId);
  };

  const closeAndRelease = (group: ActiveGroup) => {
    clearGroupTimer(group);
    presenter.close(currentEvent(group).photoId);
    group.releasePause();
  };

  const cancelActiveGroup = () => {
    if (!activeGroup) return;
    const cancelling = activeGroup;
    activeGroup = null;
    closeAndRelease(cancelling);
  };

  const buildGroupPlan = (sourceEvents: readonly TimedPhotoEvent[]) =>
    groupTimedPhotoEvents(
      sourceEvents,
      (event) => eventProgress(track, event, groupingSettings),
      groupingSettings.targetDurationSec * 1_000,
    );

  const planRemainingGroups = () => {
    plannedGroups =
      nextEventIndex === 0
        ? fullGroupPlan
        : buildGroupPlan(events.slice(nextEventIndex));
    plannedGroupIndex = 0;
  };

  const rebuildGroupPlans = () => {
    fullGroupPlan = buildGroupPlan(events);
    planRemainingGroups();
  };

  const upcomingGroup = () => plannedGroups[plannedGroupIndex];

  const cancelPreload = () => {
    cancelScheduledPreload?.();
    cancelScheduledPreload = null;
  };

  const preloadUpcomingGroup = () => {
    if (!enabled) return;
    const group = upcomingGroup();
    if (!group) return;
    const firstPhotoId = group.photoIds[0]!;
    if (firstPhotoId === preloadedGroupFirstPhotoId) return;
    preloadedGroupFirstPhotoId = firstPhotoId;
    cancelPreload();
    cancelScheduledPreload = preloadScheduler.schedule(() => {
      cancelScheduledPreload = null;
      if (destroyed || preloadedGroupFirstPhotoId !== firstPhotoId) return;
      presenter.preload(group.photoIds);
    });
  };

  const resetRunCursor = () => {
    nextEventIndex = 0;
    preloadedGroupFirstPhotoId = null;
    plannedGroups = fullGroupPlan;
    plannedGroupIndex = 0;
    cancelPreload();
  };

  const consumeDisabledEventsThrough = (snapshot: RouteAnimationSnapshot) => {
    let low = nextEventIndex;
    let high = events.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (eventProgress(track, events[middle]!, snapshot) <= snapshot.playbackProgress) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    nextEventIndex = low;
  };

  const finishGroup = (groupToken: symbol) => {
    if (destroyed || activeGroup?.groupToken !== groupToken) return;
    const finishing = activeGroup;
    activeGroup = null;
    closeAndRelease(finishing);
  };

  const openCurrentPhoto = (groupToken: symbol) => {
    if (destroyed || activeGroup?.groupToken !== groupToken) return;
    const group = activeGroup;
    const event = currentEvent(group);
    const photoToken = Symbol(`photo-${event.photoId}`);
    group.photoToken = photoToken;
    group.phase = "loading";
    clearGroupTimer(group);
    group.timerId = timerClock.setTimeout(
      () => advanceGroup(groupToken, photoToken),
      AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS,
    );
    presenter.open({
      photoId: event.photoId,
      onLoad: () => {
        if (
          destroyed ||
          activeGroup?.groupToken !== groupToken ||
          activeGroup.photoToken !== photoToken ||
          activeGroup.phase !== "loading"
        ) {
          return;
        }
        clearGroupTimer(activeGroup);
        activeGroup.phase = "visible";
        activeGroup.timerId = timerClock.setTimeout(
          () => advanceGroup(groupToken, photoToken),
          AUTOMATIC_PHOTO_VISIBLE_MS,
        );
      },
      onError: () => {
        if (activeGroup?.phase === "loading") {
          advanceGroup(groupToken, photoToken);
        }
      },
      onDismiss: () => finishGroup(groupToken),
    });
  };

  function advanceGroup(groupToken: symbol, photoToken: symbol) {
    if (
      destroyed ||
      activeGroup?.groupToken !== groupToken ||
      activeGroup.photoToken !== photoToken
    ) {
      return;
    }
    clearGroupTimer(activeGroup);
    if (activeGroup.eventIndex + 1 >= activeGroup.group.events.length) {
      finishGroup(groupToken);
      return;
    }
    activeGroup.eventIndex += 1;
    engine.moveToCursor(currentEvent(activeGroup).cursor);
    openCurrentPhoto(groupToken);
  }

  const openGroup = (group: TimedPhotoEventGroup) => {
    const firstEvent = group.events[0];
    if (!firstEvent) return;
    const groupToken = Symbol(`photo-group-${firstEvent.photoId}`);
    activeGroup = {
      group,
      eventIndex: 0,
      groupToken,
      photoToken: Symbol("pending-photo"),
      phase: "loading",
      releasePause: () => {},
      timerId: null,
    };
    const releasePause = engine.pauseAtCursor(firstEvent.cursor, "photo");
    if (!activeGroup || activeGroup.groupToken !== groupToken) {
      releasePause();
      return;
    }
    activeGroup.releasePause = releasePause;
    preloadUpcomingGroup();
    openCurrentPhoto(groupToken);
  };

  const onFrame = (snapshot: RouteAnimationSnapshot) => {
    if (destroyed) return;
    const priorState = previousState;
    previousState = snapshot.state;

    if (
      (snapshot.state === "playing" || snapshot.state === "paused") &&
      (priorState === "idle" || priorState === "completed")
    ) {
      resetRunCursor();
    }

    if (snapshot.state === "idle") {
      resetRunCursor();
      cancelActiveGroup();
      return;
    }
    if (snapshot.state !== "playing" || activeGroup) return;

    if (!enabled) {
      consumeDisabledEventsThrough(snapshot);
      return;
    }

    if (
      snapshot.playbackMode !== groupingSettings.playbackMode ||
      snapshot.skipDetectedStops !== groupingSettings.skipDetectedStops
    ) {
      return;
    }

    preloadUpcomingGroup();

    while (nextEventIndex < events.length) {
      const event = events[nextEventIndex]!;
      if (eventProgress(track, event, snapshot) > snapshot.playbackProgress) {
        return;
      }
      const group = upcomingGroup()!;
      nextEventIndex += group.events.length;
      plannedGroupIndex += 1;
      preloadedGroupFirstPhotoId = null;
      openGroup(group);
      return;
    }
  };

  rebuildGroupPlans();
  preloadUpcomingGroup();
  const unsubscribe = engine.subscribeToFrames(onFrame);

  return {
    setEnabled: (nextEnabled) => {
      if (destroyed || enabled === nextEnabled) return;
      enabled = nextEnabled;
      if (!enabled) {
        cancelPreload();
        preloadedGroupFirstPhotoId = null;
        cancelActiveGroup();
      } else {
        planRemainingGroups();
        preloadUpcomingGroup();
      }
      onFrame(engine.getSnapshot());
    },
    setGroupingSettings: (settings) => {
      if (
        destroyed ||
        (settings.playbackMode === groupingSettings.playbackMode &&
          settings.skipDetectedStops === groupingSettings.skipDetectedStops &&
          settings.targetDurationSec === groupingSettings.targetDurationSec)
      ) {
        return;
      }
      groupingSettings = settings;
      preloadedGroupFirstPhotoId = null;
      rebuildGroupPlans();
      preloadUpcomingGroup();
      onFrame(engine.getSnapshot());
    },
    destroy: () => {
      if (destroyed) return;
      unsubscribe();
      cancelPreload();
      cancelActiveGroup();
      destroyed = true;
    },
  };
}
