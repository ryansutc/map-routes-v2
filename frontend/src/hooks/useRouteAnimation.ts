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
  durationMs?: number;
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
  play: () => void;
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

function interpolatePath(coords: number[][], targetPoints: number): number[][] {
  if (coords.length < 2) return coords;
  const segCount = coords.length - 1;
  const stepsPerSeg = Math.max(1, Math.ceil(targetPoints / segCount));
  const result: number[][] = [coords[0]];
  for (let i = 0; i < segCount; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    for (let s = 1; s <= stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      result.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  return result;
}

export function useRouteAnimation(
  map: __esri.Map | null,
  view: MapView | SceneView | null,
  arcgisItemId: string | null | undefined,
  options: AnimationOptions = {},
): UseRouteAnimationReturn {
  const {
    durationMs = 26000,
    lineColor = [226, 119, 40, 255],
    lineWidth = 3,
    markerColor = [255, 50, 50, 255],
    markerSize = 10,
    targetPoints = 600,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const rafRef = useRef<number | null>(null);
  const coordsRef = useRef<number[][] | null>(null);
  const layerRef = useRef<GraphicsLayer | null>(null);
  const lineGraphicRef = useRef<Graphic | null>(null);
  const markerGraphicRef = useRef<Graphic | null>(null);

  // Fetch and cache coordinates when itemId or map changes
  useEffect(() => {
    if (!arcgisItemId) return;
    coordsRef.current = null;

    const url = PORTAL_GEOJSON_URL.replace("{itemId}", arcgisItemId);
    fetch(url)
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
        const raw = flattenGeoJSONCoords(geojson);
        coordsRef.current = interpolatePath(raw, targetPoints);
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

    const lineGraphic = new Graphic({
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
    });

    layer.addMany([lineGraphic, markerGraphic]);
    lineGraphicRef.current = lineGraphic;
    markerGraphicRef.current = markerGraphic;

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      map.remove(layer);
      layerRef.current = null;
      lineGraphicRef.current = null;
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
    // Clear the drawn line
    lineGraphicRef.current?.set(
      "geometry",
      new Polyline({ paths: [[]], spatialReference: { wkid: 4326 } }),
    );
    markerGraphicRef.current?.set("visible", false);
  }, []);

  const play = useCallback(() => {
    const coords = coordsRef.current;
    if (!coords || coords.length < 2) {
      console.warn("useRouteAnimation: coordinates not ready yet");
      return;
    }
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const total = coords.length;
    let startTime: number | null = null;

    markerGraphicRef.current?.set("visible", true);
    setIsPlaying(true);
    setProgress(0);

    function frame(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const pct = Math.min(elapsed / durationMs, 1);

      const pointCount = Math.max(2, Math.floor(pct * total));
      const slice = coords!.slice(0, pointCount);
      const last = slice[slice.length - 1];

      lineGraphicRef.current?.set(
        "geometry",
        new Polyline({ paths: [slice], spatialReference: { wkid: 4326 } }),
      );
      markerGraphicRef.current?.set(
        "geometry",
        new Point({
          longitude: last[0],
          latitude: last[1],
          spatialReference: { wkid: 4326 },
        }),
      );

      setProgress(pct);

      if (pct < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        setIsPlaying(false);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [durationMs]);

  // Stop animation on unmount
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { isPlaying, progress, play, stop };
}
