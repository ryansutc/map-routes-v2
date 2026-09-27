import type { RouteTrack } from "@/domain/timedTrack";
import Extent from "@arcgis/core/geometry/Extent";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";

const OVERVIEW_DURATION_MS = 650;
const PULLBACK_DURATION_MS = 250;

export function routeTrackExtent(track: RouteTrack): Extent | null {
  const firstPoint = track.profilePoints[0];
  if (!firstPoint) return null;

  let xmin = firstPoint.lon;
  let xmax = xmin;
  let ymin = firstPoint.lat;
  let ymax = ymin;
  for (const point of track.profilePoints) {
    xmin = Math.min(xmin, point.lon);
    xmax = Math.max(xmax, point.lon);
    ymin = Math.min(ymin, point.lat);
    ymax = Math.max(ymax, point.lat);
  }

  return new Extent({
    xmin,
    xmax,
    ymin,
    ymax,
    spatialReference: { wkid: 4326 },
  });
}

/** Fits the canonical route and adds one zoom level of context. */
export async function showCompletedRouteOverview(
  view: MapView | SceneView | null,
  track: RouteTrack,
  reducedMotion: boolean,
): Promise<void> {
  const extent = routeTrackExtent(track);
  if (!view || !extent) return;

  const orientation =
    view.type === "3d"
      ? { heading: view.camera.heading, tilt: view.camera.tilt }
      : { rotation: view.rotation };
  await view.goTo(
    { target: extent, ...orientation },
    { animate: !reducedMotion, duration: OVERVIEW_DURATION_MS },
  );

  const zoom = view.zoom;
  if (!Number.isFinite(zoom)) return;
  await view.goTo(
    { zoom: zoom - 1, ...orientation },
    { animate: !reducedMotion, duration: PULLBACK_DURATION_MS },
  );
}
