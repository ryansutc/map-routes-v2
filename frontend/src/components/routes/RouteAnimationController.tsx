import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import {
  useRouteAnimation,
  type AnimationPlaybackMode,
} from "@/hooks/useRouteAnimation";
import { useStore } from "@/state/store";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useEffect, useRef } from "react";

interface RouteAnimationControllerProps {
  map: Map | null;
  view: MapView | SceneView | null;
  arcgisItemId?: string | null;
  activityDurationSec: number | null;
  /** Notified when playback starts/stops so the page can lock map interaction. */
  onPlayingChange?: (isPlaying: boolean) => void;
}

export function RouteAnimationController({
  map,
  view,
  arcgisItemId,
  activityDurationSec,
  onPlayingChange,
}: RouteAnimationControllerProps) {
  const pointsPerSecond = useStore((state) => state.animationSpeed);
  const playbackMode = useStore((state) => state.animationPlaybackMode);
  const setPointsPerSecond = useStore((state) => state.setAnimationSpeed);
  const setPlaybackMode = useStore((state) => state.setAnimationPlaybackMode);

  const { isPlaying, progress, pointCount, play, stop } = useRouteAnimation(
    map,
    view,
    arcgisItemId,
    { pointsPerSecond, playbackMode },
  );

  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  const handleSpeedChange = (pps: number) => {
    setPointsPerSecond(pps);
    if (isPlaying) {
      stop();
      window.setTimeout(() => play(progressRef.current), 0);
    }
  };

  const handlePlaybackModeChange = (mode: AnimationPlaybackMode) => {
    setPlaybackMode(mode);
    if (isPlaying) {
      stop();
      window.setTimeout(() => play(progressRef.current), 0);
    }
  };

  return (
    <RouteAnimationControls
      arcgisItemId={arcgisItemId}
      isPlaying={isPlaying}
      progress={progress}
      pointCount={pointCount}
      pointsPerSecond={pointsPerSecond}
      playbackMode={playbackMode}
      activityDurationSec={activityDurationSec}
      onPlay={() => play()}
      onStop={stop}
      onSpeedChange={handleSpeedChange}
      onPlaybackModeChange={handlePlaybackModeChange}
    />
  );
}
