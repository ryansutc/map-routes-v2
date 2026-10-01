import {
  showCompletedRouteOverview,
  showRouteStartOverview,
} from "@/components/map/routeCompletionCamera";
import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import { RouteCompletionDialog } from "@/components/routes/RouteCompletionDialog";
import { useSettingsDialog } from "@/components/settings/SettingsDialog";
import type { PhotoMapAnchor } from "@/domain/photoMapAnchor";
import {
  availablePlaybackModes,
  isAnimationSessionActive,
  resolvePlaybackMode,
} from "@/domain/routeAnimation";
import { planTimedPhotoEvents } from "@/domain/timedPhotoEvents";
import {
  createTimedPhotoPlaybackCoordinator,
  type PhotoSessionController,
  type TimedPhotoPresenter,
} from "@/domain/timedPhotoPlayback";
import type { RouteTrack } from "@/domain/timedTrack";
import { useRouteAnimation } from "@/hooks/useRouteAnimation";
import { useStore } from "@/state/store";
import type Map from "@arcgis/core/Map";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RoutePhotoTiming = {
  id: number;
  taken_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type CompletionPhase = "transitioning" | "summary";

interface RouteAnimationControllerProps {
  getMap: () => Map | null;
  getView: () => MapView | SceneView | null;
  track: RouteTrack;
  activityType?: string;
  routeTitle?: string | null;
  distance?: number | null;
  elevationGain?: number | string | null;
  duration?: number | null;
  photos: readonly RoutePhotoTiming[];
  timedPhotoPresenter: TimedPhotoPresenter;
  photoMapAnchor: PhotoMapAnchor | null;
  /** Notified for the full active session, including composed pauses. */
  onSessionActiveChange?: (isActive: boolean) => void;
  onPhotoSessionControllerChange?: (
    controller: PhotoSessionController | null,
  ) => void;
}

export function RouteAnimationController({
  getMap,
  getView,
  track,
  activityType,
  routeTitle,
  distance,
  elevationGain,
  duration,
  photos,
  timedPhotoPresenter,
  photoMapAnchor,
  onSessionActiveChange,
  onPhotoSessionControllerChange,
}: RouteAnimationControllerProps) {
  const map = getMap();
  const view = getView();
  const targetDurationSec = useStore((state) => state.animationDurationSec);
  const preferredPlaybackMode = useStore(
    (state) => state.animationPlaybackMode,
  );
  const skipDetectedStops = useStore((state) => state.skipDetectedStops);
  const showTimedPhotos = useStore((state) => state.showTimedPhotos);
  const playbackMode = resolvePlaybackMode(track, preferredPlaybackMode);
  const { registerRouteContext } = useSettingsDialog();
  const [completionPhase, setCompletionPhase] =
    useState<CompletionPhase | null>(null);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const replayButtonRef = useRef<HTMLButtonElement>(null);
  const completionStartedRef = useRef(false);
  const completionTransitionIdRef = useRef(0);
  const playbackStartPendingRef = useRef(false);

  const {
    state,
    playbackProgress,
    pointCount,
    play,
    stop,
    photoPlaybackEngine,
    acquirePause,
  } = useRouteAnimation(map, view, track, {
    targetDurationSec,
    playbackMode,
    skipDetectedStops,
    activityType,
  });
  const isSessionActive = isAnimationSessionActive(state);
  const completionPresentationActive =
    completionPhase !== null || (state === "completed" && !completionDismissed);
  const playbackModes = useMemo(() => availablePlaybackModes(track), [track]);
  const settingsRouteContext = useMemo(
    () => ({
      availablePlaybackModes: playbackModes,
      effectivePlaybackMode: playbackMode,
      timestampCapable: track.kind === "timed",
      animationSettingsDisabled: completionPresentationActive,
      acquirePause,
    }),
    [
      acquirePause,
      completionPresentationActive,
      playbackMode,
      playbackModes,
      track.kind,
    ],
  );

  useEffect(
    () => registerRouteContext(settingsRouteContext),
    [registerRouteContext, settingsRouteContext],
  );
  const timedPhotoEvents = useMemo(
    () =>
      track.kind === "timed"
        ? planTimedPhotoEvents(
            track,
            photos.map((photo) => ({
              id: photo.id,
              takenAt: photo.taken_at,
              latitude: photo.latitude,
              longitude: photo.longitude,
            })),
          )
        : [],
    [photos, track],
  );
  const photoCoordinatorRef = useRef<ReturnType<
    typeof createTimedPhotoPlaybackCoordinator
  > | null>(null);
  const showTimedPhotosRef = useRef(showTimedPhotos);
  const timedPhotoGroupingSettingsRef = useRef({
    playbackMode,
    skipDetectedStops,
    targetDurationSec,
  });

  useEffect(() => {
    showTimedPhotosRef.current = showTimedPhotos;
    photoCoordinatorRef.current?.setEnabled(showTimedPhotos);
  }, [showTimedPhotos]);

  useEffect(() => {
    const groupingSettings = {
      playbackMode,
      skipDetectedStops,
      targetDurationSec,
    };
    timedPhotoGroupingSettingsRef.current = groupingSettings;
    photoCoordinatorRef.current?.setGroupingSettings(groupingSettings);
  }, [playbackMode, skipDetectedStops, targetDurationSec]);

  useEffect(() => {
    if (track.kind !== "timed" || !photoMapAnchor) return;
    const coordinator = createTimedPhotoPlaybackCoordinator({
      track,
      events: timedPhotoEvents,
      engine: photoPlaybackEngine,
      presenter: timedPhotoPresenter,
      enabled: showTimedPhotosRef.current,
      groupingSettings: timedPhotoGroupingSettingsRef.current,
      mapAnchor: photoMapAnchor,
    });
    photoCoordinatorRef.current = coordinator;
    onPhotoSessionControllerChange?.(coordinator);
    return () => {
      photoCoordinatorRef.current = null;
      onPhotoSessionControllerChange?.(null);
      coordinator.destroy();
    };
  }, [
    onPhotoSessionControllerChange,
    photoPlaybackEngine,
    photoMapAnchor,
    timedPhotoEvents,
    timedPhotoPresenter,
    track,
  ]);

  useEffect(() => {
    onSessionActiveChange?.(
      isSessionActive || completionPresentationActive,
    );
  }, [completionPresentationActive, isSessionActive, onSessionActiveChange]);

  useEffect(() => {
    if (state !== "completed") {
      if (completionStartedRef.current) {
        completionStartedRef.current = false;
        completionTransitionIdRef.current += 1;
      }
      return;
    }
    // handle animation complete transition
    if (completionDismissed || completionStartedRef.current) return;
    completionStartedRef.current = true;
    const transitionId = ++completionTransitionIdRef.current;
    setCompletionPhase("transitioning");
    photoCoordinatorRef.current?.dismissAutomaticPhoto();
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;

    const showCompletionSummary = async () => {
      try {
        await showCompletedRouteOverview(view, track, reducedMotion);
      } catch {
        // Camera navigation is best-effort; the summary still provides a
        // predictable end to the session when ArcGIS rejects or cancels it.
      }
      if (completionTransitionIdRef.current === transitionId) {
        setCompletionPhase("summary");
      }
    };
    void showCompletionSummary();
  }, [completionDismissed, state, track, view]);

  useEffect(
    () => () => {
      completionTransitionIdRef.current += 1;
    },
    [],
  );

  const handlePlay = useCallback(async () => {
    if (playbackStartPendingRef.current) return;
    playbackStartPendingRef.current = true;
    completionTransitionIdRef.current += 1;
    setCompletionPhase(null);
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    try {
      await showRouteStartOverview(view, track, reducedMotion);
    } catch {
      // Camera navigation is best-effort; playback should still start when
      // ArcGIS rejects or cancels the transition.
    }
    playbackStartPendingRef.current = false;
    completionStartedRef.current = false;
    setCompletionDismissed(false);
    play();
  }, [play, track, view]);

  const handleCompletionClose = useCallback(() => {
    completionTransitionIdRef.current += 1;
    setCompletionDismissed(true);
    setCompletionPhase(null);
    requestAnimationFrame(() => replayButtonRef.current?.focus());
  }, []);

  return (
    <>
      <RouteAnimationControls
        state={state}
        playbackProgress={playbackProgress}
        pointCount={pointCount}
        targetDurationSec={targetDurationSec}
        onPlay={handlePlay}
        onStop={stop}
        completionPresentationActive={completionPresentationActive}
        replayButtonRef={replayButtonRef}
      />
      <RouteCompletionDialog
        open={completionPhase === "summary"}
        title={routeTitle}
        distance={distance}
        elevationGain={elevationGain}
        duration={duration}
        onClose={handleCompletionClose}
      />
    </>
  );
}
