import type { ProfilePoint } from "@/hooks/useElevationProfile";

/**
 * Elevation at an arbitrary distance along the profile, linearly interpolated
 * between the two bracketing points (binary search, so it is cheap enough to
 * call once per animation frame).
 *
 * Used to place the animation cursor on the elevation chart: the route
 * animation reports progress as a fraction of total distance, and the profile's
 * points are not evenly spaced, so the elevation must be looked up by distance
 * rather than by array index.
 *
 * Distances outside the profile are clamped to the first/last point.
 */
export function elevationAtDistance(
  points: ProfilePoint[],
  distance: number,
): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (distance <= first.distance) return first.elevation;
  if (distance >= last.distance) return last.elevation;

  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (points[mid]!.distance <= distance) lo = mid;
    else hi = mid;
  }

  const a = points[lo]!;
  const b = points[hi]!;
  const span = b.distance - a.distance;
  if (span <= 0) return a.elevation;
  const frac = (distance - a.distance) / span;
  return a.elevation + (b.elevation - a.elevation) * frac;
}
