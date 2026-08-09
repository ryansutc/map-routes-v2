import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import {
  availablePlaybackModes,
  isAnimationSessionActive,
  resolvePlaybackMode,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
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
import Map from "@arcgis/core/Map";
import { useEffect, useMemo, useRef } from "react";

type RoutePhotoTiming = {
  id: number;
  taken_at?: string | null;
};

interface RouteAnimationControllerProps {
  map: Map | null;
  track: RouteTrack;
  photos: readonly RoutePhotoTiming[];
  timedPhotoPresenter: TimedPhotoPresenter;
  activityDurationSec: number | null;
  /** Notified for the full active session, including composed pauses. */
  onSessionActiveChange?: (isActive: boolean) => void;
  onPhotoSessionControllerChange?: (
    controller: PhotoSessionController | null,
  ) => void;
}

export function RouteAnimationController({
  map,
  track,
  photos,
  timedPhotoPresenter,
  activityDurationSec,
  onSessionActiveChange,
  onPhotoSessionControllerChange,
}: RouteAnimationControllerProps) {
  const targetDurationSec = useStore((state) => state.animationDurationSec);
  const preferredPlaybackMode = useStore(
    (state) => state.animationPlaybackMode,
  );
  const setTargetDurationSec = useStore(
    (state) => state.setAnimationDurationSec,
  );
  const setPreferredPlaybackMode = useStore(
    (state) => state.setAnimationPlaybackMode,
  );
  const skipDetectedStops = useStore((state) => state.skipDetectedStops);
  const setSkipDetectedStops = useStore((state) => state.setSkipDetectedStops);
  const showTimedPhotos = useStore((state) => state.showTimedPhotos);
  const setShowTimedPhotos = useStore((state) => state.setShowTimedPhotos);
  const setAnimationDistanceProgress = useStore(
    (state) => state.setAnimationDistanceProgress,
  );
  const playbackMode = resolvePlaybackMode(track, preferredPlaybackMode);

  const {
    state,
    playbackProgress,
    distanceProgress,
    pointCount,
    play,
    stop,
    photoPlaybackEngine,
  } = useRouteAnimation(map, track, {
      targetDurationSec,
      playbackMode,
      skipDetectedStops,
    });
  const isSessionActive = isAnimationSessionActive(state);
  const timedPhotoEvents = useMemo(
    () =>
      track.kind === "timed"
        ? planTimedPhotoEvents(
            track,
            photos.map((photo) => ({
              id: photo.id,
              takenAt: photo.taken_at,
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
    if (track.kind !== "timed") return;
    const coordinator = createTimedPhotoPlaybackCoordinator({
      track,
      events: timedPhotoEvents,
      engine: photoPlaybackEngine,
      presenter: timedPhotoPresenter,
      enabled: showTimedPhotosRef.current,
      groupingSettings: timedPhotoGroupingSettingsRef.current,
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
    timedPhotoEvents,
    timedPhotoPresenter,
    track,
  ]);

  useEffect(() => {
    onSessionActiveChange?.(isSessionActive);
  }, [isSessionActive, onSessionActiveChange]);

  // Elevation is spatial, so publish marker distance rather than the selected
  // playback timeline. Reset on unmount to avoid a stale cursor after routing.
  useEffect(() => {
    setAnimationDistanceProgress(distanceProgress);
  }, [distanceProgress, setAnimationDistanceProgress]);

  useEffect(
    () => () => {
      setAnimationDistanceProgress(0);
    },
    [setAnimationDistanceProgress],
  );

  const handleDurationChange = (duration: TargetRouteDurationSec) => {
    setTargetDurationSec(duration);
  };

  const handlePlaybackModeChange = (mode: RoutePlaybackMode) => {
    setPreferredPlaybackMode(mode);
  };

  return (
    <RouteAnimationControls
      state={state}
      playbackProgress={playbackProgress}
      pointCount={pointCount}
      targetDurationSec={targetDurationSec}
      playbackMode={playbackMode}
      availablePlaybackModes={availablePlaybackModes(track)}
      timestampCapable={track.kind === "timed"}
      skipDetectedStops={skipDetectedStops}
      showTimedPhotos={showTimedPhotos}
      timedPhotoCounts={{
        eligible: timedPhotoEvents.length,
        total: photos.length,
      }}
      activityDurationSec={activityDurationSec}
      onPlay={play}
      onStop={stop}
      onDurationChange={handleDurationChange}
      onPlaybackModeChange={handlePlaybackModeChange}
      onSkipDetectedStopsChange={setSkipDetectedStops}
      onShowTimedPhotosChange={setShowTimedPhotos}
    />
  );
}
