import type Layer from "@arcgis/core/layers/Layer";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

export const PHOTO_MARKERS_LAYER_ID = "photo-markers";
export const ROUTE_ANIMATION_TRAIL_LAYER_ID = "route-animation-trail";
export const ROUTE_ANIMATION_MARKER_LAYER_ID = "route-animation-marker";

/**
 * Adds the animation trail below route layers and its marker above them.
 * Photo markers remain above both animation layers.
 */
export function addRouteAnimationLayers(
  map: __esri.Map,
  trailLayer: GraphicsLayer,
  markerLayer: GraphicsLayer,
): void {
  map.add(trailLayer, 0);

  const photoMarkers = map.findLayerById(PHOTO_MARKERS_LAYER_ID);
  const markerIndex = photoMarkers
    ? map.layers.indexOf(photoMarkers)
    : map.layers.length;
  map.add(markerLayer, markerIndex);
}

/** Adds a displayed route below the animation marker and photo markers. */
export function addRouteLayer(map: __esri.Map, routeLayer: Layer): void {
  const nextLayer =
    map.findLayerById(ROUTE_ANIMATION_MARKER_LAYER_ID) ??
    map.findLayerById(PHOTO_MARKERS_LAYER_ID);
  const routeIndex = nextLayer
    ? map.layers.indexOf(nextLayer)
    : map.layers.length;
  map.add(routeLayer, routeIndex);
}
