import type { AnimationPosition } from "@/domain/routeAnimation";
import { createRouteFollowController } from "./routeFollowController";
import {
  ANIMATION_CONTROLS_RESERVED_HEIGHT_PX,
  MAP_OVERLAY_GAP_PX,
} from "./mapOverlayLayout";
import { BALL_VERTICAL_OFFSET_PX } from "./routeMarkerLayout";
import type { TrackCoordinate } from "@/domain/timedTrack";
import Point from "@arcgis/core/geometry/Point";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";

export type RoutePlaybackView = MapView | SceneView;
export type FollowPosition = Readonly<{ coordinate: TrackCoordinate }>;

// Preserve the transition timing and easing chosen during visual testing.
export const FOLLOW_TRANSITION_DURATION_MS = 1300;

/** Captures the follow zoom once so preference toggles cannot compound it. */
export function captureFollowZoom(
  view: RoutePlaybackView | null,
): number | null {
  if (!view || !Number.isFinite(view.zoom)) return null;
  return view.zoom + 1;
}

/** Centers a route position while retaining the session zoom and orientation. */
export async function centerRoutePosition(
  view: RoutePlaybackView | null,
  position: FollowPosition | null,
  zoom: number | null,
  animate: boolean,
  options: { duration?: number; signal?: AbortSignal } = {},
): Promise<void> {
  if (!view || !position || zoom === null) return;
  const orientation =
    view.type === "3d"
      ? { heading: view.camera.heading, tilt: view.camera.tilt }
      : { rotation: view.rotation };
  const [longitude, latitude] = position.coordinate;
  await view.goTo(
    {
      target: new Point({
        longitude,
        latitude,
        spatialReference: { wkid: 4326 },
      }),
      zoom,
      ...orientation,
    },
    animate
      ? {
          animate,
          duration: options.duration ?? FOLLOW_TRANSITION_DURATION_MS,
          easing: "ease-in-out",
          ...options,
        }
      : { animate, ...options },
  );
}

/** ArcGIS projection/navigation stays here; scheduling and policy stay replaceable. */
export function createRouteFollowCamera(
  view: RoutePlaybackView | null,
  getPositionAfter: (milliseconds: number) => AnimationPosition | null,
  reducedMotion: () => boolean,
) {
  let zoom: number | null = null;
  const verticalClearance = view?.type === "3d" ? BALL_VERTICAL_OFFSET_PX : 0;
  const point = new Point({ spatialReference: { wkid: 4326 } });
  const controller = createRouteFollowController(
    {
      project(position) {
        if (!view?.ready) return null;
        point.longitude = position.coordinate[0];
        point.latitude = position.coordinate[1];
        // The rendered marker is relative to terrain, not the GPX altitude.
        const projected = view.toScreen(point);
        if (
          !projected ||
          !Number.isFinite(projected.x) ||
          !Number.isFinite(projected.y)
        )
          return null;
        return { x: projected.x, y: projected.y };
      },
      viewport() {
        if (
          !view?.ready ||
          view.width <= 0 ||
          view.height <= 0 ||
          zoom === null
        )
          return null;
        const padding = {
          left: view.padding.left ?? 0,
          right: view.padding.right ?? 0,
          top: view.padding.top ?? 0,
          bottom: view.padding.bottom ?? 0,
        };
        const radius = 18;
        const bounds = {
          left: padding.left + MAP_OVERLAY_GAP_PX + radius,
          right: view.width - padding.right - MAP_OVERLAY_GAP_PX - radius,
          top: padding.top + MAP_OVERLAY_GAP_PX + radius + verticalClearance,
          bottom:
            view.height -
            padding.bottom -
            ANIMATION_CONTROLS_RESERVED_HEIGHT_PX -
            radius,
          center: {
            x: (view.width + padding.left - padding.right) / 2,
            y: (view.height + padding.top - padding.bottom) / 2,
          },
        };
        return bounds.right > bounds.left && bounds.bottom > bounds.top
          ? bounds
          : null;
      },
      move: (position, options) =>
        centerRoutePosition(view, position, zoom, options.animate, {
          duration: options.duration,
          signal: options.signal,
        }),
    },
    {
      getPositionAfter,
      reducedMotion,
      duration: FOLLOW_TRANSITION_DURATION_MS,
    },
  );
  return {
    ...controller,
    setZoom(value: number | null) {
      zoom = value;
    },
  };
}
