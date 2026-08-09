import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { describe, expect, it } from "vitest";
import {
  addRouteAnimationLayer,
  PHOTO_MARKERS_LAYER_ID,
} from "./mapLayerOrder";

describe("addRouteAnimationLayer", () => {
  it("keeps the route line below photo markers", () => {
    const map = new Map();
    const photoMarkers = new GraphicsLayer({ id: PHOTO_MARKERS_LAYER_ID });
    const animationLayer = new GraphicsLayer({ id: "routeAnimationLayer" });
    map.add(photoMarkers);

    addRouteAnimationLayer(map, animationLayer);

    expect(map.layers.indexOf(animationLayer)).toBeLessThan(
      map.layers.indexOf(photoMarkers),
    );
  });

  it("appends the animation layer when there are no photo markers", () => {
    const map = new Map();
    const existingLayer = new GraphicsLayer({ id: "existing-layer" });
    const animationLayer = new GraphicsLayer({ id: "routeAnimationLayer" });
    map.add(existingLayer);

    addRouteAnimationLayer(map, animationLayer);

    expect(map.layers.at(-1)).toBe(animationLayer);
  });
});
