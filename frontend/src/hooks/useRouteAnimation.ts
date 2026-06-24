import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useCallback, useEffect, useRef, useState } from "react";

const ANIMATION_LAYER_ID = "routeAnimationLayer";
const PORTAL_GEOJSON_URL =
  "https://www.arcgis.com/sharing/rest/content/items/{itemId}/data";

interface AnimationOptions {
  pointsPerSecond?: number;
  lineColor?: [number, number, number, number];
  lineWidth?: number;
  markerColor?: [number, number, number, number];
  markerSize?: number;
  /** Densify sparse routes to this many points for smooth playback */
  targetPoints?: number;
}

interface UseRouteAnimationReturn {
  isPlaying: boolean;
  progress: number; // 0–1
  pointCount: number | null;
  play: (startProgress?: number) => void;
  stop: () => void;
}

function flattenGeoJSONCoords(
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature,
): number[][] {
  const features =
    geojson.type === "FeatureCollection" ? geojson.features : [geojson];

  const coords: number[][] = [];
  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === "LineString") {
      coords.push(...(geom.coordinates as number[][]));
    } else if (geom.type === "MultiLineString") {
      for (const segment of geom.coordinates as number[][][]) {
        coords.push(...segment);
      }
    }
  }
  return coords;
}

/**
 * Resamples coords to exactly targetPoints by walking cumulative arc length.
 * Handles both sparse (densify) and dense (downsample) routes.
 */
function resamplePath(coords: number[][], targetPoints: number): number[][] {
  if (coords.length < 2) return coords;
  if (coords.length <= targetPoints) {
    // Dense enough already — no need to densify
    // But if way over target, downsample via uniform stride
    if (coords.length <= targetPoints * 1.5) return coords;
  }

  // Compute cumulative distances
  const dists: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1] as [number, number];
    const [x1, y1] = coords[i] as [number, number];
    const dx = x1 - x0, dy = y1 - y0;
    dists.push(dists[i - 1]! + Math.sqrt(dx * dx + dy * dy));
  }
  const totalDist = dists[dists.length - 1]!;

  const result: number[][] = [];
  let srcIdx = 0;
  for (let t = 0; t < targetPoints; t++) {
    const targetDist = (t / (targetPoints - 1)) * totalDist;
    while (srcIdx < dists.length - 2 && dists[srcIdx + 1]! < targetDist) srcIdx++;
    const d0 = dists[srcIdx]!, d1 = dists[srcIdx + 1] ?? d0;
    const segLen = d1 - d0;
    const frac = segLen > 0 ? (targetDist - d0) / segLen : 0;
    const [x0, y0] = coords[srcIdx] as [number, number];
    const [x1, y1] = (coords[srcIdx + 1] ?? coords[srcIdx]) as [number, number];
    result.push([x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac]);
  }
  return result;
}

export function useRouteAnimation(
  map: __esri.Map | null,
  _view: MapView | SceneView | null,
  arcgisItemId: string | null | undefined,
  options: AnimationOptions = {},
): UseRouteAnimationReturn {
  const {
    pointsPerSecond = 50,
    lineColor = [226, 119, 40, 255],
    lineWidth = 3,
    markerColor = [255, 50, 50, 255],
    markerSize = 10,
    targetPoints = 1000,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pointCount, setPointCount] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const coordsRef = useRef<number[][] | null>(null);
  const layerRef = useRef<GraphicsLayer | null>(null);
  const staticLineGraphicRef = useRef<Graphic | null>(null);
  const markerGraphicRef = useRef<Graphic | null>(null);
  const lastProgressFrameRef = useRef<number>(0);

  // Fetch and cache coordinates when itemId or map changes
  useEffect(() => {
    if (!arcgisItemId) return;
    coordsRef.current = null;
    setPointCount(null);

    const url = PORTAL_GEOJSON_URL.replace("{itemId}", arcgisItemId);
    fetch(url)
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
        const raw = flattenGeoJSONCoords(geojson);
        const resampled = resamplePath(raw, targetPoints);
        coordsRef.current = resampled;
        setPointCount(resampled.length);
      })
      .catch((err) =>
        console.error("useRouteAnimation: failed to fetch GeoJSON", err),
      );
  }, [arcgisItemId, targetPoints]);

  // Set up (or tear down) the GraphicsLayer on the map
  useEffect(() => {
    if (!map) return;

    const layer = new GraphicsLayer({ id: ANIMATION_LAYER_ID });
    map.add(layer);
    layerRef.current = layer;

    const lineSym = new SimpleLineSymbol({
      color: lineColor,
      width: lineWidth,
      cap: "round",
      join: "round",
    });
    const markerSym = new SimpleMarkerSymbol({
      color: markerColor,
      size: markerSize,
      outline: { color: [255, 255, 255, 200], width: 1.5 },
    });

    const staticLineGraphic = new Graphic({
      geometry: new Polyline({ paths: [[]], spatialReference: { wkid: 4326 } }),
      symbol: lineSym,
    });
    const markerGraphic = new Graphic({
      geometry: new Point({
        longitude: 0,
        latitude: 0,
        spatialReference: { wkid: 4326 },
      }),
      symbol: markerSym,
      visible: false,
    });

    layer.addMany([staticLineGraphic, markerGraphic]);
    staticLineGraphicRef.current = staticLineGraphic;
    markerGraphicRef.current = markerGraphic;

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      map.remove(layer);
      layerRef.current = null;
      staticLineGraphicRef.current = null;
      markerGraphicRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    markerGraphicRef.current?.set("visible", false);
  }, []);

  const play = useCallback(
    (startProgress = 0) => {
      const coords = coordsRef.current;
      if (!coords || coords.length < 2) {
        console.warn("useRouteAnimation: coordinates not ready yet");
        return;
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      const total = coords.length;
      const durationMs = (total / pointsPerSecond) * 1000;
      const offsetMs = startProgress * durationMs;
      let startTime: number | null = null;

      lastProgressFrameRef.current = 0;

      // Draw the full route as a static line once
      staticLineGraphicRef.current?.set(
        "geometry",
        new Polyline({ paths: [coords], spatialReference: { wkid: 4326 } }),
      );

      markerGraphicRef.current?.set("visible", true);
      setIsPlaying(true);
      setProgress(startProgress);

      function frame(timestamp: number) {
        if (!startTime) startTime = timestamp - offsetMs;
        const elapsed = timestamp - startTime;
        const pct = Math.min(elapsed / durationMs, 1);

        const pointIdx = Math.max(0, Math.floor(pct * (total - 1)));
        const [lng, lat] = coords![pointIdx] as [number, number];

        markerGraphicRef.current?.set(
          "geometry",
          new Point({
            longitude: lng,
            latitude: lat,
            spatialReference: { wkid: 4326 },
          }),
        );

        // Update React state at ~10fps to avoid stutter
        if (timestamp - lastProgressFrameRef.current >= 100) {
          lastProgressFrameRef.current = timestamp;
          setProgress(pct);
        }

        if (pct < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          setProgress(1);
          rafRef.current = null;
          setIsPlaying(false);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    },
    [pointsPerSecond],
  );

  // Stop animation on unmount
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { isPlaying, progress, pointCount, play, stop };
}
