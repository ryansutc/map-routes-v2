import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import { useRouteAnimation } from "@/hooks/useRouteAnimation";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useEffect, useRef, useState } from "react";

interface RouteAnimationControllerProps {
  map: Map | null;
  view: MapView | SceneView | null;
  arcgisItemId?: string | null;
  activityDurationSec: number | null;
}

export function RouteAnimationController({
  map,
  view,
  arcgisItemId,
  activityDurationSec,
}: RouteAnimationControllerProps) {
  const [pointsPerSecond, setPointsPerSecond] = useState(50);
  const [playbackMode, setPlaybackMode] = useState<"indexed" | "distance">(
    "indexed",
  );

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

  const handleSpeedChange = (pps: number) => {
    setPointsPerSecond(pps);
    if (isPlaying) {
      stop();
      window.setTimeout(() => play(progressRef.current), 0);
    }
  };

  const handlePlaybackModeChange = (mode: "indexed" | "distance") => {
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
