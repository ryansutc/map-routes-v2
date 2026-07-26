import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import { useEffect } from "react";

/** Pointer/keyboard events that drive the ESRI navigation manager. */
const NAVIGATION_EVENTS = [
  "drag",
  "mouse-wheel",
  "double-click",
  "key-down",
  "key-up",
] as const;

/**
 * Suppresses map navigation while `locked` is true. Used for the mobile
 * preview (tap should open fullscreen, not pan the map) and while the route
 * animation is playing.
 */
export function useMapInteractionLock(
  view: MapView | SceneView | null,
  locked: boolean,
) {
  useEffect(() => {
    if (!view || !locked) return;

    const handles = NAVIGATION_EVENTS.map((eventName) =>
      // The handler signature is identical across these events; the cast just
      // collapses the per-event overloads on the MapView/SceneView union.
      (view as MapView).on(
        eventName as "drag",
        (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
        },
      ),
    );

    return () => {
      handles.forEach((handle) => handle.remove());
    };
  }, [view, locked]);
}
