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
import type { PhotoMapAnchor } from "./photoMapAnchor";

export const AUTOMATIC_PHOTO_VISIBLE_MS = 2_000;
export const AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS = 10_000;

declare const photoSessionIdBrand: unique symbol;
declare const photoPresentationTokenBrand: unique symbol;

export type PhotoSessionId = symbol & {
  readonly [photoSessionIdBrand]: "PhotoSessionId";
};

type PhotoPresentationToken = symbol & {
  readonly [photoPresentationTokenBrand]: "PhotoPresentationToken";
};

function createPhotoSessionId(description: string): PhotoSessionId {
  return Symbol(description) as PhotoSessionId;
}

function createPhotoPresentationToken(
  description: string,
): PhotoPresentationToken {
  return Symbol(description) as PhotoPresentationToken;
}

export type AutomaticPhotoPresentation = {
  kind: "automatic";
  sessionId: PhotoSessionId;
  photoId: number;
  onLoad: () => void;
  onError: () => void;
  onDismiss: () => void;
  onNavigate: (photoId: number) => void;
  onTimerPauseChange: (paused: boolean) => void;
};

export type ManualPhotoPresentation = {
  kind: "manual";
  sessionId: PhotoSessionId;
  photoId: number;
  onDismiss: () => void;
  onStop: () => void;
};

export type AnimationPhotoPresentation =
  | AutomaticPhotoPresentation
  | ManualPhotoPresentation;

export type TimedPhotoPresenter = {
  open: (presentation: AnimationPhotoPresentation) => void;
  close: (sessionId: PhotoSessionId) => void;
  preload: (photoIds: readonly number[]) => void;
};

export type PhotoTimerClock = {
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timerId: unknown) => void;
};

export type PhotoPreloadScheduler = {
  schedule: (callback: () => void) => () => void;
};

type PhotoPlaybackEngine = Pick<
  RouteAnimationEngine,
  | "getSnapshot"
  | "subscribeToFrames"
  | "pauseAtCursor"
  | "moveToCursor"
  | "acquirePause"
  | "stop"
>;

type ActiveGroup = {
  group: TimedPhotoEventGroup;
  eventIndex: number;
  sessionId: PhotoSessionId;
  photoToken: PhotoPresentationToken;
  phase: "loading" | "visible";
  releasePause: () => void;
  timerId: unknown | null;
  timerStartedAtMs: number | null;
  timerRemainingMs: number;
  interactionPaused: boolean;
};

type ActiveManualSession = {
  sessionId: PhotoSessionId;
  releasePause: () => void;
};

export type TimedPhotoPlaybackCoordinator = {
  setEnabled: (enabled: boolean) => void;
  setGroupingSettings: (settings: TimedPhotoGroupingSettings) => void;
  openManualPhoto: (photoId: number) => boolean;
  destroy: () => void;
};

export type PhotoSessionController = Pick<
  TimedPhotoPlaybackCoordinator,
  "openManualPhoto"
>;

export type TimedPhotoGroupingSettings = Pick<
  RouteAnimationSnapshot,
  "playbackMode" | "skipDetectedStops"
> & {
  targetDurationSec: number;
};

function browserPhotoTimerClock(): PhotoTimerClock {
  return {
    now: () => performance.now(),
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
  mapAnchor,
}: {
  track: TimedTrack;
  events: readonly TimedPhotoEvent[];
  engine: PhotoPlaybackEngine;
  presenter: TimedPhotoPresenter;
  enabled: boolean;
  groupingSettings: TimedPhotoGroupingSettings;
  timerClock?: PhotoTimerClock;
  preloadScheduler?: PhotoPreloadScheduler;
  mapAnchor: PhotoMapAnchor;
}): TimedPhotoPlaybackCoordinator {
  let enabled = initialEnabled;
  let groupingSettings = initialGroupingSettings;
  let destroyed = false;
  let nextEventIndex = 0;
  let previousState = engine.getSnapshot().state;
  let activeGroup: ActiveGroup | null = null;
  let activeManualSession: ActiveManualSession | null = null;
  let documentHidden = false;
  let preloadedGroupFirstPhotoId: number | null = null;
  let fullGroupPlan: readonly TimedPhotoEventGroup[] = [];
  let plannedGroups: readonly TimedPhotoEventGroup[] = [];
  let plannedGroupIndex = 0;
  let cancelScheduledPreload: (() => void) | null = null;

  const currentEvent = (group: ActiveGroup) =>
    group.group.events[group.eventIndex]!;

  const clearGroupTimer = (group: ActiveGroup) => {
    const active = group;
    if (active.timerId === null) return;
    timerClock.clearTimeout(active.timerId);
    active.timerId = null;
    if (active.timerStartedAtMs !== null) {
      active.timerRemainingMs = Math.max(
        0,
        active.timerRemainingMs -
          (timerClock.now() - active.timerStartedAtMs),
      );
    }
    active.timerStartedAtMs = null;
  };

  const scheduleGroupTimer = (group: ActiveGroup) => {
    const active = group;
    if (documentHidden || active.interactionPaused || active.timerId !== null)
      return;
    const { sessionId, photoToken } = active;
    active.timerStartedAtMs = timerClock.now();
    active.timerId = timerClock.setTimeout(
      () => advanceGroup(sessionId, photoToken),
      active.timerRemainingMs,
    );
  };

  const startGroupTimer = (group: ActiveGroup, delayMs: number) => {
    const active = group;
    clearGroupTimer(active);
    active.timerRemainingMs = delayMs;
    scheduleGroupTimer(active);
  };

  const updateDocumentHidden = (hidden: boolean) => {
    if (documentHidden === hidden) return;
    documentHidden = hidden;
    if (!activeGroup) return;
    if (hidden) clearGroupTimer(activeGroup);
    else scheduleGroupTimer(activeGroup);
  };

  const closeAndRelease = (group: ActiveGroup) => {
    clearGroupTimer(group);
    presenter.close(group.sessionId);
    group.releasePause();
  };

  const cancelActiveGroup = () => {
    if (!activeGroup) return;
    const cancelling = activeGroup;
    activeGroup = null;
    closeAndRelease(cancelling);
  };

  const cancelActiveManualSession = () => {
    if (!activeManualSession) return;
    const cancelling = activeManualSession;
    activeManualSession = null;
    presenter.close(cancelling.sessionId);
    cancelling.releasePause();
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

  const finishGroup = (sessionId: PhotoSessionId) => {
    if (destroyed || activeGroup?.sessionId !== sessionId) return;
    const finishing = activeGroup;
    activeGroup = null;
    closeAndRelease(finishing);
  };

  const finishManualSession = (
    sessionId: PhotoSessionId,
    stopPlayback: boolean,
  ) => {
    if (destroyed || activeManualSession?.sessionId !== sessionId) return;
    const finishing = activeManualSession;
    activeManualSession = null;
    presenter.close(sessionId);
    if (stopPlayback) engine.stop();
    finishing.releasePause();
  };

  const openManualSession = (sessionId: PhotoSessionId, photoId: number) => {
    const releaseManualPause = engine.acquirePause("manual-gallery");
    if (activeGroup) {
      const automatic = activeGroup;
      activeGroup = null;
      clearGroupTimer(automatic);
      automatic.releasePause();
    }
    cancelActiveManualSession();
    activeManualSession = { sessionId, releasePause: releaseManualPause };
    presenter.open({
      kind: "manual",
      sessionId,
      photoId,
      onDismiss: () => finishManualSession(sessionId, false),
      onStop: () => finishManualSession(sessionId, true),
    });
  };

  const openCurrentPhoto = (sessionId: PhotoSessionId) => {
    if (destroyed || activeGroup?.sessionId !== sessionId) return;
    const group = activeGroup;
    const event = currentEvent(group);
    const photoToken = createPhotoPresentationToken(`photo-${event.photoId}`);
    group.photoToken = photoToken;
    group.phase = "loading";
    startGroupTimer(group, AUTOMATIC_PHOTO_LOAD_TIMEOUT_MS);
    presenter.open({
      kind: "automatic",
      sessionId,
      photoId: event.photoId,
      onLoad: () => {
        if (
          destroyed ||
          activeGroup?.sessionId !== sessionId ||
          activeGroup.photoToken !== photoToken ||
          activeGroup.phase !== "loading"
        ) {
          return;
        }
        activeGroup.phase = "visible";
        startGroupTimer(activeGroup, AUTOMATIC_PHOTO_VISIBLE_MS);
      },
      onError: () => {
        if (activeGroup?.phase === "loading") {
          advanceGroup(sessionId, photoToken);
        }
      },
      onDismiss: () => finishGroup(sessionId),
      onNavigate: (photoId) => {
        if (
          destroyed ||
          activeGroup?.sessionId !== sessionId ||
          activeGroup.photoToken !== photoToken
        ) {
          return;
        }
        openManualSession(sessionId, photoId);
      },
      onTimerPauseChange: (paused) => {
        if (
          destroyed ||
          activeGroup?.sessionId !== sessionId ||
          activeGroup.photoToken !== photoToken ||
          activeGroup.interactionPaused === paused
        ) {
          return;
        }
        activeGroup.interactionPaused = paused;
        if (activeGroup.phase !== "visible") return;
        if (paused) clearGroupTimer(activeGroup);
        else scheduleGroupTimer(activeGroup);
      },
    });
  };

  function advanceGroup(
    sessionId: PhotoSessionId,
    photoToken: PhotoPresentationToken,
  ) {
    if (
      destroyed ||
      activeGroup?.sessionId !== sessionId ||
      activeGroup.photoToken !== photoToken
    ) {
      return;
    }
    clearGroupTimer(activeGroup);
    do {
      activeGroup.eventIndex += 1;
      if (activeGroup.eventIndex >= activeGroup.group.events.length) {
        finishGroup(sessionId);
        return;
      }
    } while (!mapAnchor.getSnapshot(currentEvent(activeGroup).photoId)?.visible);
    engine.moveToCursor(currentEvent(activeGroup).cursor);
    openCurrentPhoto(sessionId);
  }

  const openGroup = (group: TimedPhotoEventGroup) => {
    const firstVisibleEventIndex = group.events.findIndex(
      (event) => mapAnchor.getSnapshot(event.photoId)?.visible,
    );
    if (firstVisibleEventIndex < 0) return;
    const firstEvent = group.events[firstVisibleEventIndex];
    if (!firstEvent) return;
    const sessionId = createPhotoSessionId(`photo-group-${firstEvent.photoId}`);
    activeGroup = {
      group,
      eventIndex: firstVisibleEventIndex,
      sessionId,
      photoToken: createPhotoPresentationToken("pending-photo"),
      phase: "loading",
      releasePause: () => {},
      timerId: null,
      timerStartedAtMs: null,
      timerRemainingMs: 0,
      interactionPaused: false,
    };
    const releasePause = engine.pauseAtCursor(firstEvent.cursor, "photo");
    if (!activeGroup || activeGroup.sessionId !== sessionId) {
      releasePause();
      return;
    }
    activeGroup.releasePause = releasePause;
    preloadUpcomingGroup();
    openCurrentPhoto(sessionId);
  };

  const onFrame = (snapshot: RouteAnimationSnapshot) => {
    if (destroyed) return;
    updateDocumentHidden(
      snapshot.activePauseReasons.includes("document-hidden"),
    );
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
      cancelActiveManualSession();
      return;
    }
    if (snapshot.state !== "playing" || activeGroup || activeManualSession)
      return;

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
    openManualPhoto: (photoId) => {
      if (destroyed) return false;
      const { state } = engine.getSnapshot();
      if (state !== "playing" && state !== "paused") return false;
      openManualSession(createPhotoSessionId(`manual-photo-${photoId}`), photoId);
      return true;
    },
    destroy: () => {
      if (destroyed) return;
      unsubscribe();
      cancelPreload();
      cancelActiveGroup();
      cancelActiveManualSession();
      destroyed = true;
    },
  };
}
