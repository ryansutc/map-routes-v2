import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { describe, expect, it } from "vitest";
import {
  addRouteAnimationLayers,
  addRouteLayer,
  PHOTO_MARKERS_LAYER_ID,
  ROUTE_ANIMATION_MARKER_LAYER_ID,
  ROUTE_ANIMATION_TRAIL_LAYER_ID,
} from "./mapLayerOrder";

describe("route map layer ordering", () => {
  it("places the trail below the route and the marker above it", () => {
    const map = new Map();
    const routeLayer = new GraphicsLayer({ id: "route" });
    const photoMarkers = new GraphicsLayer({ id: PHOTO_MARKERS_LAYER_ID });
    const trailLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_TRAIL_LAYER_ID,
    });
    const markerLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_MARKER_LAYER_ID,
    });
    map.add(routeLayer);
    map.add(photoMarkers);

    addRouteAnimationLayers(map, trailLayer, markerLayer);

    expect(map.layers.toArray()).toEqual([
      trailLayer,
      routeLayer,
      markerLayer,
      photoMarkers,
    ]);
  });

  it("preserves the ordering when the route is added after animation layers", () => {
    const map = new Map();
    const routeLayer = new GraphicsLayer({ id: "route" });
    const trailLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_TRAIL_LAYER_ID,
    });
    const markerLayer = new GraphicsLayer({
      id: ROUTE_ANIMATION_MARKER_LAYER_ID,
    });

    addRouteAnimationLayers(map, trailLayer, markerLayer);
    addRouteLayer(map, routeLayer);

    expect(map.layers.toArray()).toEqual([
      trailLayer,
      routeLayer,
      markerLayer,
    ]);
  });
});
