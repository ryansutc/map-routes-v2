import type Graphic from "@arcgis/core/Graphic";
import type Point from "@arcgis/core/geometry/Point";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import type { PhotoMapAnchor } from "@/domain/photoMapAnchor";

const PHOTO_MARKER_RADIUS_PX = 18;

export type ArcGisPhotoMapAnchor = PhotoMapAnchor & { destroy: () => void };

/** Keeps ArcGIS projection and view observation behind the neutral anchor seam. */
export function createArcGisPhotoMapAnchor(
  view: MapView | SceneView,
  graphicsByPhotoId: ReadonlyMap<number, Graphic>,
): ArcGisPhotoMapAnchor {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const handles = [
    view.watch("extent", notify),
    view.watch("size", notify),
    view.type === "3d"
      ? view.watch("camera", notify)
      : view.watch("rotation", notify),
  ];

  return {
    getSnapshot: (photoId) => {
      const graphic = graphicsByPhotoId.get(photoId);
      if (!graphic?.geometry) return null;
      const screenPoint = view.toScreen(graphic.geometry as Point);
      if (!screenPoint) return null;
      const viewportWidth = view.width;
      const viewportHeight = view.height;
      return {
        x: screenPoint.x,
        y: screenPoint.y,
        viewportWidth,
        viewportHeight,
        visible:
          screenPoint.x - PHOTO_MARKER_RADIUS_PX >= 0 &&
          screenPoint.x + PHOTO_MARKER_RADIUS_PX <= viewportWidth &&
          screenPoint.y - PHOTO_MARKER_RADIUS_PX >= 0 &&
          screenPoint.y + PHOTO_MARKER_RADIUS_PX <= viewportHeight,
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      handles.forEach((handle) => handle.remove());
      listeners.clear();
    },
  };
}
