import { useEffect, useMemo, useRef } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import Point from "@arcgis/core/geometry/Point";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import type { FeatureCollection } from "geojson";
import type GeoJSON from "geojson";

export type ProfilePoint = {
  distance: number;
  elevation: number;
  lon: number;
  lat: number;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HOVER_LAYER_ID = "elevationHoverLayer";

const hoverSymbol = new SimpleMarkerSymbol({
  color: [255, 255, 0, 255],
  outline: { color: [0, 0, 0, 200], width: 1.5 },
  size: 10,
  style: "circle",
});

export function useElevationProfile(
  geojson: FeatureCollection | null | undefined,
  view: MapView | SceneView | null
): {
  profilePoints: ProfilePoint[];
  hasElevation: boolean;
  onHover: (index: number) => void;
  onHoverEnd: () => void;
} {
  const layerRef = useRef<GraphicsLayer | null>(null);

  // Create/destroy the hover graphics layer with the view
  useEffect(() => {
    if (!view) return;
    const layer = new GraphicsLayer({ id: HOVER_LAYER_ID });
    view.map?.add(layer);
    layerRef.current = layer;
    return () => {
      view.map?.remove(layer);
      layerRef.current = null;
    };
  }, [view]);

  const { profilePoints, hasElevation } = useMemo(() => {
    if (!geojson) return { profilePoints: [], hasElevation: false };

    const feature = geojson.features.find(
      (f: GeoJSON.Feature) => f.geometry?.type === "LineString"
    );
    if (!feature || feature.geometry.type !== "LineString") {
      return { profilePoints: [], hasElevation: false };
    }

    const coords = feature.geometry.coordinates as [number, number, number?][];
    let cumDist = 0;
    const points: ProfilePoint[] = coords.map((coord, i) => {
      if (i > 0) {
        const prev = coords[i - 1]!;
        cumDist += haversineMeters(prev[1], prev[0], coord[1], coord[0]);
      }
      return {
        distance: cumDist,
        elevation: coord[2] ?? 0,
        lon: coord[0],
        lat: coord[1],
      };
    });

    const hasElev =
      points.length > 0 && points.some((p) => p.elevation !== 0);

    return { profilePoints: points, hasElevation: hasElev };
  }, [geojson]);

  const onHover = (index: number) => {
    const layer = layerRef.current;
    if (!layer) return;
    const pt = profilePoints[index];
    if (!pt) return;
    layer.removeAll();
    layer.add(
      new Graphic({
        geometry: new Point({ longitude: pt.lon, latitude: pt.lat }),
        symbol: hoverSymbol,
      })
    );
  };

  const onHoverEnd = () => {
    layerRef.current?.removeAll();
  };

  return { profilePoints, hasElevation, onHover, onHoverEnd };
}
