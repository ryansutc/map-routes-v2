import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import {
  availablePlaybackModes,
  isAnimationSessionActive,
  resolvePlaybackMode,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import type { RouteTrack } from "@/domain/timedTrack";
import { useRouteAnimation } from "@/hooks/useRouteAnimation";
import { useStore } from "@/state/store";
import Map from "@arcgis/core/Map";
import { useEffect } from "react";

interface RouteAnimationControllerProps {
  map: Map | null;
  track: RouteTrack;
  activityDurationSec: number | null;
  /** Notified for the full active session, including composed pauses. */
  onSessionActiveChange?: (isActive: boolean) => void;
}

export function RouteAnimationController({
  map,
  track,
  activityDurationSec,
  onSessionActiveChange,
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
  const setAnimationDistanceProgress = useStore(
    (state) => state.setAnimationDistanceProgress,
  );
  const playbackMode = resolvePlaybackMode(track, preferredPlaybackMode);

  const { state, playbackProgress, distanceProgress, pointCount, play, stop } =
    useRouteAnimation(map, track, {
      targetDurationSec,
      playbackMode,
    });
  const isSessionActive = isAnimationSessionActive(state);

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
      activityDurationSec={activityDurationSec}
      onPlay={play}
      onStop={stop}
      onDurationChange={handleDurationChange}
      onPlaybackModeChange={handlePlaybackModeChange}
    />
  );
}
