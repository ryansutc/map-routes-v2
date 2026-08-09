import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

export const PHOTO_MARKERS_LAYER_ID = "photo-markers";

/** Adds the animation route below photo markers so its line cannot cover them. */
export function addRouteAnimationLayer(
  map: __esri.Map,
  animationLayer: GraphicsLayer,
): void {
  const photoMarkers = map.findLayerById(PHOTO_MARKERS_LAYER_ID);
  if (!photoMarkers) {
    map.add(animationLayer);
    return;
  }

  map.add(animationLayer, map.layers.indexOf(photoMarkers));
}
