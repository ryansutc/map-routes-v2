# PRD: Elevation Profile on Route Detail Page

## Problem Statement

When viewing a route, users have no way to visualize the elevation changes along the track. The route detail page shows aggregate stats (total elevation gain) but gives no sense of where climbs and descents occur, how steep they are, or how elevation varies across the full distance. This makes it hard to understand the character of a route before attempting it.

## Solution

Add an elevation profile chart to the route detail page, rendered from the GPX track's elevation data. The chart is a line chart (Recharts) showing elevation on the Y-axis and cumulative distance on the X-axis. Hovering the chart shows a tooltip with elevation and distance, and places a point marker on the map at the corresponding location. The feature requires storing 3D coordinates (lon, lat, elevation) in GeoJSON throughout the stack.

## User Stories

1. As a route viewer, I want to see an elevation profile chart on the route detail page so that I can understand the climb and descent pattern of the route.
2. As a route viewer, I want the X-axis of the chart to show cumulative distance so that I can relate elevation changes to how far along the route I am.
3. As a route viewer, I want the Y-axis to show elevation in my preferred unit system (metric/imperial) so that the values are meaningful to me.
4. As a route viewer, I want to hover over the chart and see a tooltip with the exact elevation and distance at that point so that I can inspect specific sections of the route.
5. As a route viewer, I want hovering the chart to place a marker on the map at the corresponding location so that I can visually correlate chart position with map position.
6. As a route viewer, I want the elevation chart to appear below the photo gallery in the right panel so that route stats, photos, and elevation are all in one scrollable column.
7. As a route viewer, I want to see a "No elevation information available" message instead of a chart when a route has no elevation data, so that the UI is always informative.
8. As a route creator, I want the GPX upload to preserve elevation data in the stored GeoJSON so that elevation profiles are available for routes I upload.
9. As a route viewer, I want the route line in 3D mode to continue draping on the terrain surface even after elevation data is stored, so that the map display is not broken by Z-coordinate data.
10. As a route viewer on mobile, I want the elevation chart to have a fixed height and appear below photos in the stacked layout so that it doesn't disrupt the mobile experience.

## Implementation Decisions

### Backend

**`django_backend/apps/routes/gpx_utils.py`**
- Update `parse_gpx` to include elevation as the third coordinate in GeoJSON LineString: `[longitude, latitude, elevation]` (standard GeoJSON 3D).
- Points with `None` elevation should fall back to `0.0`.
- The returned `geojson` field will now contain 3D coordinates.

**`django_backend/apps/routes/views.py` (`ParseGpxView`)**
- No interface change — the 3D GeoJSON flows through the existing `geojson` field in the response.
- The 3D GeoJSON is uploaded to ArcGIS Online (replacing the current 2D upload) so both the SQLite record and the ArcGIS-hosted copy are consistent.

**No schema migration required** — the `geojson` field is a `JSONField`; it accepts 3D coordinates without any model change.

### Frontend — ArcGIS Layer

**`src/components/map/LayerController.tsx`**
- Add `elevationInfo: { mode: "on-the-ground" }` to the `GeoJSONLayer` constructor.
- This ensures the route line always drapes on terrain in 3D SceneView, regardless of whether the GeoJSON contains Z values. Without this, ArcGIS defaults to `"absolute-height"` mode for layers with Z coordinates, which would float the line in the air.

### Frontend — Elevation Hook

**New file: `src/hooks/useElevationProfile.ts`**
- Accepts `geojson: GeoJSON.FeatureCollection | null | undefined` and `view: MapView | SceneView | null`.
- Derives `profilePoints: Array<{ distance: number; elevation: number; lon: number; lat: number }>` from the GeoJSON LineString coordinates.
  - Cumulative distance computed via Haversine formula on `[lon, lat]` pairs.
  - Elevation read from the third coordinate; if absent or all zero, `hasElevation` is `false`.
- Creates and manages a dedicated ArcGIS `GraphicsLayer` (id: `"elevationHoverLayer"`) on the map for the hover marker.
- Exposes:
  ```ts
  {
    profilePoints: ProfilePoint[];
    hasElevation: boolean;
    onHover: (index: number) => void;   // places marker on map
    onHoverEnd: () => void;             // removes marker
  }
  ```
- Cleans up the `GraphicsLayer` on unmount.

### Frontend — Chart Component

**New file: `src/components/map/ElevationProfile.tsx`**
- Renders a Recharts `LineChart` with:
  - X-axis: cumulative distance, formatted via `formatDistance(units)` from `src/utils/units.ts`.
  - Y-axis: elevation, formatted via `formatElevation(units)` from `src/utils/units.ts`.
  - `<Tooltip>` showing distance + elevation at hovered point.
  - Fixed height (e.g. 180px).
- Calls `onHover(index)` / `onHoverEnd()` from `useElevationProfile` on Recharts `onMouseMove` / `onMouseLeave`.
- When `hasElevation` is `false`, renders a `<Typography>` element: "No elevation information available." instead of the chart.
- Reads unit preference from the Zustand store (`useAppStore(state => state.units)`).

### Frontend — Route Detail Page

**`src/routes/routes/$routeId.tsx`**
- Pass `map`, `view`, and `routeItem.geojson` to `useElevationProfile`.
- Render `<ElevationProfile>` below `<PhotoGallery>` in the right panel.
- The photos section should use `overflowY: "auto"` with a `maxHeight` so photos scroll before the elevation chart, which has a fixed height at the bottom.

### Dependencies

- Add `recharts` to `frontend/package.json`.

### Units

- Respects the global `units` preference (`"metric"` | `"imperial"`) from the Zustand store.
- Uses existing `formatDistance` and `formatElevation` from `src/utils/units.ts`.

## Out of Scope

- Syncing the elevation chart hover position with the route animation playback.
- Backfilling elevation data for existing routes (routes uploaded before this change will show "No elevation information available").
- Showing grade/gradient percentage on the chart.
- Smoothing or filtering noisy GPS elevation data.
- Displaying elevation profile in the route list/card view.
- A separate API endpoint for elevation profile data.

## Further Notes

- The ArcGIS-hosted GeoJSON and the SQLite `geojson` field will both contain 3D coordinates after this change, keeping them in sync.
- The map rendering (both 2D and 3D) is unaffected by Z-coordinate storage because `elevationInfo: { mode: "on-the-ground" }` is added to `LayerController`.
- The `useRouteAnimation` hook fetches GeoJSON from ArcGIS directly; it currently uses 2D coordinates for densification. After this change it will receive 3D coordinates — the animation logic should be verified to handle or strip the Z value without breakage.
- The hover marker on the map should be a distinct symbol (e.g. a small filled circle in a contrasting color) so it is clearly visible over the route line.
