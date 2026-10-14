import type { TrackCoordinate } from "@/domain/timedTrack";
import Point from "@arcgis/core/geometry/Point";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";

export type RoutePlaybackView = MapView | SceneView;
export type FollowPosition = Readonly<{ coordinate: TrackCoordinate }>;

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
    { animate },
  );
}
