import { ball3D } from "@/components/map/layerSymbols/3dSymbol";
import { bikeIcon } from "@/components/map/layerSymbols/bikeIcon";
import { hikerSymbol } from "@/components/map/layerSymbols/hikerIcon";
import {
  addRouteAnimationLayers,
  ROUTE_ANIMATION_MARKER_LAYER_ID,
  ROUTE_ANIMATION_TRAIL_LAYER_ID,
} from "@/components/map/mapLayerOrder";
import {
  buildRouteTrailPaths,
  createRouteAnimationEngine,
  isAnimationSessionActive,
  type AnimationPauseReason,
  type RouteAnimationSettings,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import type { RouteTrack } from "@/domain/timedTrack";
import { routeAnimationProgress } from "@/state/routeAnimationProgress";
import Color from "@arcgis/core/Color";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import CIMSymbol from "@arcgis/core/symbols/CIMSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import {
  applyCIMSymbolColor,
  scaleCIMSymbolTo,
} from "@arcgis/core/symbols/support/cimSymbolUtils.js";
import { useEffect, useMemo, useSyncExternalStore } from "react";

const DEFAULT_LINE_COLOR: [number, number, number, number] = [
  160, 160, 160, 60,
];
interface AnimationOptions {
  targetDurationSec: TargetRouteDurationSec;
  playbackMode: RoutePlaybackMode;
  skipDetectedStops: boolean;
  activityType?: string;
  lineColor?: [number, number, number, number];
  lineWidth?: number;
  markerColor?: [number, number, number, number];
  markerSize?: number;
}

/**
 * Connects the route playback engine to an ArcGIS line and moving map marker.
 * Used by `RouteAnimationController` to expose playback state and controls.
 *
 * @param map - Map that hosts the animation layer, or `null` until available.
 * @param view - Active 2D or 3D view used to select the marker symbol.
 * @param track - Route geometry and timing data to animate.
 * @param options - Playback behavior and optional map-symbol styling.
 */
export function useRouteAnimation(
  map: __esri.Map | null,
  view: __esri.MapView | __esri.SceneView | null,
  track: RouteTrack,
  options: AnimationOptions,
) {
  const {
    targetDurationSec,
    playbackMode,
    skipDetectedStops,
    activityType,
    lineColor = DEFAULT_LINE_COLOR,
    lineWidth = 6,
    markerColor,
    markerSize,
  } = options;

  const initialSettings = useMemo<RouteAnimationSettings>(
    () => ({
      targetDurationSec,
      playbackMode,
      skipDetectedStops,
    }),
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
    engine.configure({
      targetDurationSec,
      playbackMode,
      skipDetectedStops,
    });
  }, [engine, playbackMode, skipDetectedStops, targetDurationSec]);

  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => {
    // Frame snapshots keep the map marker and lightweight elevation cursor on
    // the same spatial distance without involving application-store middleware.
    routeAnimationProgress.publish(engine.getSnapshot().distanceProgress);
    const unsubscribe = engine.subscribeToFrames((frameSnapshot) => {
      routeAnimationProgress.publish(frameSnapshot.distanceProgress);
    });
    return () => {
      unsubscribe();
      routeAnimationProgress.reset();
    };
  }, [engine]);

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
    if (!map || !view) return;

    const trailLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_TRAIL_LAYER_ID,
      elevationInfo: { mode: "on-the-ground" },
    });
    const markerLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_MARKER_LAYER_ID,
      elevationInfo: {
        mode: view.type === "3d" ? "relative-to-ground" : "on-the-ground",
      },
      screenSizePerspectiveEnabled: false,
    });
    const staticLineGraphic = new Graphic({
      geometry: new Polyline({
        paths: [],
        spatialReference: { wkid: 4326 },
      }),
      symbol: new SimpleLineSymbol({
        color: lineColor,
        width: lineWidth,
        cap: "round",
        join: "round",
      }),
      visible: false,
    });
    const markerSymbol =
      view.type === "3d"
        ? ball3D.clone()
        : new CIMSymbol({
            data: {
              type: "CIMSymbolReference",
              symbol: activityType === "Cycling" ? bikeIcon : hikerSymbol,
            },
          });
    if (markerSymbol.type === "cim") {
      if (markerColor) {
        const [red, green, blue, alpha] = markerColor;
        applyCIMSymbolColor(
          markerSymbol,
          new Color([red, green, blue, alpha / 255]),
        );
      }
      if (markerSize !== undefined) {
        scaleCIMSymbolTo(markerSymbol, markerSize);
      }
    }
    const markerGraphic = new Graphic({
      geometry: new Point({
        longitude: 0,
        latitude: 0,
        spatialReference: { wkid: 4326 },
      }),
      symbol: markerSymbol,
      visible: false,
    });

    trailLayer.add(staticLineGraphic);
    markerLayer.add(markerGraphic);
    addRouteAnimationLayers(map, trailLayer, markerLayer);

    const unsubscribe = engine.subscribeToFrames((frameSnapshot) => {
      const position = frameSnapshot.position;
      const sessionActive = isAnimationSessionActive(frameSnapshot.state);
      staticLineGraphic.set("visible", sessionActive && !!position);
      if (sessionActive && position) {
        staticLineGraphic.set(
          "geometry",
          new Polyline({
            paths: buildRouteTrailPaths(track, position),
            spatialReference: { wkid: 4326 },
          }),
        );
      }
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
      map.removeMany([trailLayer, markerLayer]);
    };
  }, [
    activityType,
    engine,
    lineColor,
    lineWidth,
    map,
    markerColor,
    markerSize,
    track,
    view,
  ]);

  return {
    ...snapshot,
    pointCount: track.profilePoints.length,
    play: engine.play,
    stop: engine.stop,
    acquirePause: (reason: AnimationPauseReason) => engine.acquirePause(reason),
    photoPlaybackEngine: engine,
  };
}
