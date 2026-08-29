// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer";
import type PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D";
import { describe, expect, it } from "vitest";

import { ROUTE_ANIMATION_MARKER_LAYER_ID } from "@/components/map/mapLayerOrder";
import { buildRouteTrack } from "@/domain/timedTrack";
import { useRouteAnimation } from "./useRouteAnimation";

const track = buildRouteTrack({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-123, 49],
          [-123.001, 49.001],
        ],
      },
      properties: {},
    },
  ],
});

describe("3D route animation marker", () => {
  it("renders a fixed-size sphere icon with a screen-space lift", () => {
    const map = new Map();

    const { unmount } = renderHook(() =>
      useRouteAnimation(
        map,
        { type: "3d" } as __esri.SceneView,
        track,
        {
          targetDurationSec: 20,
          playbackMode: "distance",
          skipDetectedStops: false,
        },
      ),
    );

    const markerLayer = map.findLayerById(ROUTE_ANIMATION_MARKER_LAYER_ID);
    expect(markerLayer).toBeInstanceOf(GraphicsLayer);
    if (!(markerLayer instanceof GraphicsLayer)) {
      throw new Error("Expected the route animation marker GraphicsLayer");
    }

    expect(markerLayer.elevationInfo?.mode).toBe("relative-to-ground");
    expect(markerLayer.screenSizePerspectiveEnabled).toBe(false);

    const symbol = markerLayer.graphics.at(0)?.symbol as PointSymbol3D;
    expect(symbol.type).toBe("point-3d");
    expect(symbol.symbolLayers.length).toBe(1);
    const symbolLayer = symbol.symbolLayers.at(0);
    expect(symbolLayer).toBeInstanceOf(IconSymbol3DLayer);
    if (!(symbolLayer instanceof IconSymbol3DLayer)) {
      throw new Error("Expected a screen-sized IconSymbol3DLayer");
    }
    expect(symbolLayer.resource?.href).toMatch(
      /^(?:data:image\/svg\+xml|.*sphereMarker\.svg)/,
    );
    // ArcGIS normalizes the configured 24 CSS pixels to 18 points.
    expect(symbolLayer.size).toBe(18);
    expect(symbol.verticalOffset?.screenLength).toBe(18);

    unmount();
  });
});
