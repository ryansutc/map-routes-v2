# Elevation Profile — Implementation Plan

Reference PRD: `plans/prd-elevation-profile.md`

## Phases

### Phase 1 — Backend: 3D GeoJSON

**Files:** `django_backend/apps/routes/gpx_utils.py`

- Update `parse_gpx` to emit `[longitude, latitude, elevation]` coordinates in the GeoJSON LineString.
- Points with `None` elevation fall back to `0.0`.
- The 3D GeoJSON flows through the existing `geojson` field — no schema migration required.

### Phase 2 — Backend: Tests

**Files:** backend test file for `gpx_utils`

- Update or add tests asserting that parsed coordinates include a third (elevation) value.
- Verify fallback to `0.0` for points missing elevation.

### Phase 3 — Frontend: LayerController Terrain Drape Fix

**Files:** `frontend/src/components/map/LayerController.tsx`

- Add `elevationInfo: { mode: "on-the-ground" }` to the `GeoJSONLayer` constructor.
- Ensures the route line drapes on terrain in 3D SceneView regardless of Z coordinates in the GeoJSON.

### Phase 4 — Frontend: Install Recharts

**Files:** `frontend/package.json`

- Add `recharts` as a dependency.
- Run `pnpm install`.

### Phase 5 — Frontend: `useElevationProfile` Hook

**Files:** `frontend/src/hooks/useElevationProfile.ts`

- Accepts `geojson: GeoJSON.FeatureCollection | null | undefined` and `view: MapView | SceneView | null`.
- Derives `profilePoints: ProfilePoint[]` from the LineString coordinates:
  - `ProfilePoint = { distance: number; elevation: number; lon: number; lat: number }`
  - Cumulative distance computed via Haversine formula on `[lon, lat]` pairs.
  - Elevation read from third coordinate.
  - `hasElevation` is `false` when no third coordinate exists or all elevations are `0`.
- Creates and manages a dedicated `GraphicsLayer` (id: `"elevationHoverLayer"`) for the hover marker.
- Exposes:
  ```ts
  {
    profilePoints: ProfilePoint[];
    hasElevation: boolean;
    onHover: (index: number) => void;
    onHoverEnd: () => void;
  }
  ```
- Cleans up the `GraphicsLayer` on unmount.
- Hover marker is a small filled circle in a contrasting color, clearly visible over the route line.

### Phase 6 — Frontend: `ElevationProfile` Component

**Files:** `frontend/src/components/map/ElevationProfile.tsx`

- Renders a Recharts `LineChart` at a fixed height (180px).
- X-axis: cumulative distance, formatted via `formatDistance` from `src/utils/units.ts`.
- Y-axis: elevation, formatted via `formatElevation` from `src/utils/units.ts`.
- Recharts `<Tooltip>` showing distance + elevation at hovered point.
- Calls `onHover(index)` / `onHoverEnd()` on `onMouseMove` / `onMouseLeave`.
- Reads unit preference from Zustand store (`useAppStore(state => state.units)`).
- When `hasElevation` is `false`, renders `<Typography>No elevation information available.</Typography>` instead of the chart.

### Phase 7 — Frontend: Wire into Route Detail Page

**Files:** `frontend/src/routes/routes/$routeId.tsx`

- Pass `map`, `view`, and `routeItem.geojson` to `useElevationProfile`.
- Render `<ElevationProfile>` below `<PhotoGallery>` in the right panel. It should be pinned to the bottom of the page view.
- Add `overflowY: "auto"` and a `maxHeight` to the photos section so photos scroll independently, leaving the elevation chart fixed at the bottom.

### Phase 8 — Verification

- Run `pnpm run typecheck` from `frontend/` — must pass.
- Run `pnpm run test` from `frontend/` — must pass.
- Run backend linter/typecheck (`ruff`) — must pass.
- Manually verify: chart renders, hover tooltip works, map marker appears, 3D terrain drape is intact, fallback text shows for routes without elevation.

## Acceptance Criteria

- [ ] GPX parse produces 3D GeoJSON coordinates
- [ ] 3D GeoJSON uploaded to ArcGIS (existing flow, no interface change)
- [ ] Route line still drapes on terrain in 3D SceneView
- [ ] Elevation chart renders in right panel below photos
- [ ] Chart X-axis shows cumulative distance in user's unit system
- [ ] Chart Y-axis shows elevation in user's unit system
- [ ] Hovering chart shows tooltip with distance + elevation
- [ ] Hovering chart places a marker on the map at the correct location
- [ ] Routes without elevation data show fallback text
- [ ] All typecheck and test loops pass

## Out of Scope

See `plans/prd-elevation-profile.md` — Out of Scope section.
