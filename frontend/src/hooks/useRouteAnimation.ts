import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createRouteAnimationEngine,
  type AnimationPauseReason,
  type RouteAnimationSettings,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import type { RouteTrack } from "@/domain/timedTrack";

const ANIMATION_LAYER_ID = "routeAnimationLayer";
const DEFAULT_LINE_COLOR: [number, number, number, number] = [
  226, 119, 40, 255,
];
const DEFAULT_MARKER_COLOR: [number, number, number, number] = [
  255, 50, 50, 255,
];

interface AnimationOptions {
  targetDurationSec: TargetRouteDurationSec;
  playbackMode: RoutePlaybackMode;
  lineColor?: [number, number, number, number];
  lineWidth?: number;
  markerColor?: [number, number, number, number];
  markerSize?: number;
}

function pathsFromTrack(track: RouteTrack): number[][][] {
  const paths: number[][][] = [];
  for (const point of track.profilePoints) {
    const path = paths[point.segmentIndex] ?? [];
    path.push([point.lon, point.lat, point.elevation]);
    paths[point.segmentIndex] = path;
  }
  return paths;
}

export function useRouteAnimation(
  map: __esri.Map | null,
  track: RouteTrack,
  options: AnimationOptions,
) {
  const {
    targetDurationSec,
    playbackMode,
    lineColor = DEFAULT_LINE_COLOR,
    lineWidth = 3,
    markerColor = DEFAULT_MARKER_COLOR,
    markerSize = 10,
  } = options;

  const initialSettings = useMemo<RouteAnimationSettings>(
    () => ({ targetDurationSec, playbackMode }),
    // Settings changes are applied through configure so the current route
    // position survives them; only route data creates a new session engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track],
  );
  const engine = useMemo(
    () => createRouteAnimationEngine(track, initialSettings),
    [initialSettings, track],
  );
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  useEffect(() => {
    engine.configure({ targetDurationSec, playbackMode });
  }, [engine, playbackMode, targetDurationSec]);

  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let releaseVisibilityPause: (() => void) | null = null;
    const updateVisibilityPause = () => {
      if (document.hidden && !releaseVisibilityPause) {
        releaseVisibilityPause = engine.acquirePause("document-hidden");
      } else if (!document.hidden && releaseVisibilityPause) {
        releaseVisibilityPause();
        releaseVisibilityPause = null;
      }
    };
    updateVisibilityPause();
    document.addEventListener("visibilitychange", updateVisibilityPause);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibilityPause);
      releaseVisibilityPause?.();
    };
  }, [engine]);

  useEffect(() => {
    if (!map) return;

    const layer = new GraphicsLayer({ id: ANIMATION_LAYER_ID });
    const staticLineGraphic = new Graphic({
      geometry: new Polyline({
        paths: pathsFromTrack(track),
        spatialReference: { wkid: 4326 },
      }),
      symbol: new SimpleLineSymbol({
        color: lineColor,
        width: lineWidth,
        cap: "round",
        join: "round",
      }),
    });
    const markerGraphic = new Graphic({
      geometry: new Point({
        longitude: 0,
        latitude: 0,
        spatialReference: { wkid: 4326 },
      }),
      symbol: new SimpleMarkerSymbol({
        color: markerColor,
        size: markerSize,
        outline: { color: [255, 255, 255, 200], width: 1.5 },
      }),
      visible: false,
    });

    layer.addMany([staticLineGraphic, markerGraphic]);
    map.add(layer);

    const unsubscribe = engine.subscribeToFrames((frameSnapshot) => {
      const position = frameSnapshot.position;
      markerGraphic.set(
        "visible",
        frameSnapshot.state !== "idle" && !!position,
      );
      if (!position) return;
      markerGraphic.set(
        "geometry",
        new Point({
          longitude: position.coordinate[0],
          latitude: position.coordinate[1],
          spatialReference: { wkid: 4326 },
        }),
      );
    });

    return () => {
      unsubscribe();
      map.remove(layer);
    };
  }, [engine, lineColor, lineWidth, map, markerColor, markerSize, track]);

  return {
    ...snapshot,
    pointCount: track.profilePoints.length,
    play: engine.play,
    stop: engine.stop,
    acquirePause: (reason: AnimationPauseReason) => engine.acquirePause(reason),
  };
}
