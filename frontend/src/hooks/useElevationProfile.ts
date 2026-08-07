import { useEffect, useMemo, useRef } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import Point from "@arcgis/core/geometry/Point";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import type { FeatureCollection } from "geojson";
import { buildRouteTrack, type TrackProfilePoint } from "@/domain/timedTrack";

export type ProfilePoint = Pick<
  TrackProfilePoint,
  "distance" | "elevation" | "lon" | "lat"
>;

const HOVER_LAYER_ID = "elevationHoverLayer";

const hoverSymbol = new SimpleMarkerSymbol({
  color: [255, 255, 0, 255],
  outline: { color: [0, 0, 0, 200], width: 1.5 },
  size: 10,
  style: "circle",
});

export function useElevationProfile(
  geojson: FeatureCollection | null | undefined,
  view: MapView | SceneView | null,
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

    const points = [...buildRouteTrack(geojson).profilePoints];

    const hasElev = points.length > 0 && points.some((p) => p.elevation !== 0);

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
      }),
    );
  };

  const onHoverEnd = () => {
    layerRef.current?.removeAll();
  };

  return { profilePoints, hasElevation, onHover, onHoverEnd };
}
