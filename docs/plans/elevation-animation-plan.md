# Elevation Profile Animation

## Context

When a route animation plays, a marker travels along the route on the map, but the elevation profile chart rendered beneath the map (desktop only) stays static. The user has no way to see where they are in the _climb_ — only where they are on the _map_. This feature adds a synchronized cursor to the elevation profile so playback progress reads on both views at once, and disables the chart's hover interactivity during playback so the two don't fight over the map.

Scope is desktop-only by consequence, not by special-casing: on mobile the chart is not rendered in fullscreen and the animation controls are hidden in preview, so the two are never on screen together. No mobile layout changes.

## Design decisions (resolved)

| Decision          | Choice                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Visual            | `ReferenceDot` on the elevation line + faint vertical `ReferenceLine`                     |
| Smoothness        | Recharts declarative refs at ~20fps; memoize static chart parts                           |
| Progress plumbing | Non-persisted slice on the main store + convert bare `useStore()` call sites to selectors |
| Progress → x-axis | Distance fraction, elevation interpolated by binary search                                |
| Hover disable     | Transparent pointer-events overlay + clear stale hover marker                             |
| Cursor visibility | `isPlaying \|\| progress > 0` — mirrors the map marker exactly                            |

## Key constraint discovered

The animation and the profile do **not** share coordinates and have **no index correspondence**:

- [useRouteAnimation.ts](frontend/src/hooks/useRouteAnimation.ts) fetches GeoJSON from ArcGIS Portal and runs it through `resamplePath(raw, 1000)` — planar distances, **no elevation**.
- [useElevationProfile.ts](frontend/src/hooks/useElevationProfile.ts) builds `ProfilePoint[] {distance, elevation, lon, lat}` from `routeItem.geojson` using cumulative **haversine** meters.

Therefore the cursor must be positioned by **distance fraction** (`progress * totalDistance`), not array index. This is exact for `"distance"` playback mode and for the normal 1000-point resample (uniform spacing ⇒ index fraction ≡ distance fraction). It can drift slightly from the marker in `"indexed"` mode when `resamplePath` early-returns raw coords (routes of 1000–1500 points with uneven spacing). Accepted as a known, minor imprecision — not worth changing animation behavior for.

## Implementation

### 1. Progress state on the main store — [store.ts](frontend/src/state/store.ts)

Add to `MapRouteState` and the initial state:

```ts
animationProgress: number;              // 0–1
setAnimationProgress: (p: number) => void;
```

with a setter following the existing `set({...}, undefined, "animation/setAnimationProgress")` convention. Deliberately **not** added to `partialize` ([store.ts:97-102](frontend/src/state/store.ts#L97-L102) is a whitelist) so it never persists.

**Prerequisite — fix the bare `useStore()` call sites.** Because this field updates ~20×/sec, any component subscribing without a selector re-renders on every frame. Convert all of them to selectors:

```diff
- const { units } = useStore();
+ const units = useStore((s) => s.units);
```

Sites (from `grep -rn "useStore()" src`):

- [AppShell.tsx:29-30](frontend/src/components/layout/AppShell.tsx#L29-L30) — destructures 6 fields; **on the route page, so this one is mandatory**
- [RouteInfoContainer.tsx:39](frontend/src/components/map/RouteInfoContainer.tsx#L39) — **on the route page, mandatory**
- [ElevationProfile.tsx:36](frontend/src/components/map/ElevationProfile.tsx#L36) — **mandatory**
- `RouteTableView.tsx:51`, `RouteCardGrid.tsx:34`, `RouteMetadataStep.tsx:60`, `MainWrapper.tsx:11`, `auth/callback.tsx:11` — not on the route page; convert anyway so the footgun doesn't reappear

For multi-field sites like `AppShell`, use one `useStore(s => s.x)` call per field (simplest and correctly memoized) rather than an object-returning selector, which would need `useShallow`.

Note: the `devtools` middleware will log an action per progress update, so Redux DevTools gets noisy during playback. Dev-only, harmless — but worth knowing before someone reports it as a bug.

### 2. Loosen the progress throttle — [useRouteAnimation.ts](frontend/src/hooks/useRouteAnimation.ts)

In the `shouldUpdateProgress({...})` call inside `frame()`, change `intervalMs: 100, threshold: 0.01` → `intervalMs: 50, threshold: 0.005` (~20fps, 200 steps). Reuses the existing [useRouteAnimationUtils.ts](frontend/src/hooks/useRouteAnimationUtils.ts) helper — no new throttling machinery. Check `useRouteAnimation.test.ts` for assertions that hard-code the old interval/threshold and update them.

The 33ms marker-geometry throttle stays as-is.

### 3. Publish progress — [RouteAnimationController.tsx](frontend/src/components/routes/RouteAnimationController.tsx)

Add one effect alongside the existing `onPlayingChange` effect that pushes `progress` into the store via `setAnimationProgress`, plus a cleanup that resets it to `0` on unmount so a stale cursor can't survive navigation.

`isPlaying` does **not** need to go through the store — `$routeId.tsx` already tracks it as `isAnimating` (set via the existing `onPlayingChange` → `setIsAnimating` at [$routeId.tsx:195](frontend/src/routes/routes/$routeId.tsx#L195)) and already renders `ElevationProfile`. So pass it down as a new `isAnimating` prop on `elevationSection` ([$routeId.tsx:212-219](frontend/src/routes/routes/$routeId.tsx#L212-L219)) and reuse existing wiring. Only `progress` needs the store, because it is too high-frequency to lift into the page.

### 4. Animated cursor — [ElevationProfile.tsx](frontend/src/components/map/ElevationProfile.tsx)

- Replace bare `const { units } = useStore()` with `useStore(s => s.units)` (see step 1 — mandatory here).
- Subscribe: `const progress = useStore(s => s.animationProgress)`.
- Accept a new `isAnimating: boolean` prop (default `false`).
- `const showCursor = hasElevation && (isAnimating || progress > 0)`.
- Compute `cursorDistance = progress * totalDistance` and derive `cursorElevation` by binary-searching `profilePoints` for the bracketing distances and lerping elevation. Put this in a small pure helper (e.g. `elevationAtDistance(profilePoints, distance)`) so it is unit-testable independent of React/Recharts.
- Render inside `<LineChart>` when `showCursor`:
  - `<ReferenceLine x={cursorDistance} stroke="#888" strokeDasharray="3 3" />`
  - `<ReferenceDot x={cursorDistance} y={cursorElevation} r={5} fill="#ff3232" stroke="#fff" strokeWidth={1.5} />` — `#ff3232` matches the animation marker's `markerColor = [255, 50, 50, 255]`.
- Keep `isAnimationActive={false}` on both so Recharts doesn't tween them.

**Render cost:** the `<Line>`, axes and `data` prop are stable, so the expensive path re-renders are not recomputed per frame; only the two reference elements change. If profiling still shows jank on long routes, the fallback is to memoize the chart subtree or thin `profilePoints` for rendering — do not pre-optimize.

### 5. Disable hover during playback — [ElevationProfile.tsx](frontend/src/components/map/ElevationProfile.tsx)

- Wrap `<ResponsiveContainer>` in `<Box sx={{ position: "relative" }}>`.
- When `isAnimating`, render a sibling `<Box sx={{ position: "absolute", inset: 0, zIndex: 2 }} />` to swallow pointer events. This reuses the same overlay technique already used for the mobile map thumbnail in [$routeId.tsx](frontend/src/routes/routes/$routeId.tsx).
- Add an effect: when `isAnimating` becomes true, call `onHoverEnd()` once so the leftover yellow `elevationHoverLayer` graphic is cleared from the map and doesn't sit there during playback.

## Files touched

- `frontend/src/state/store.ts` — add `animationProgress` / `setAnimationProgress` (not persisted)
- `frontend/src/components/map/ElevationProfile.tsx` — cursor, overlay, `isAnimating` prop, selector
- `frontend/src/routes/routes/$routeId.tsx` — pass `isAnimating` to `ElevationProfile`
- `frontend/src/components/routes/RouteAnimationController.tsx` — publish progress
- `frontend/src/hooks/useRouteAnimation.ts` — throttle 100ms/1% → 50ms/0.5%
- `frontend/src/hooks/useRouteAnimation.test.ts` — update throttle assertions if present
- Bare-`useStore()` → selector conversions: [AppShell.tsx](frontend/src/components/layout/AppShell.tsx), [RouteInfoContainer.tsx](frontend/src/components/map/RouteInfoContainer.tsx), plus `RouteTableView.tsx`, `RouteCardGrid.tsx`, `RouteMetadataStep.tsx`, `MainWrapper.tsx`, `auth/callback.tsx`
- New test covering the `elevationAtDistance` helper

Deliberately **not** touched: `useElevationProfile.ts`, mobile layout branches.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` in `frontend/`.
2. Unit-test `elevationAtDistance`: distance 0 → first point's elevation; distance ≥ total → last point's; a midpoint distance → correctly lerped; empty array → safe default.
3. Manual, desktop viewport (> 860px), on a route with elevation data:
   - Press play. A red dot rides the profile line with a dashed vertical line beneath it, moving left→right in step with the map marker. Verify at both a slow and a fast animation speed, and in **both** `indexed` and `distance` playback modes (Animation Settings popover).
   - While playing, hover the chart: no tooltip, no yellow map marker appears, cursor unchanged.
   - Hover the chart _before_ pressing play so a yellow marker is drawn, then press play — the yellow marker should disappear.
   - Let playback run to completion: dot parks at the far right, map marker parks at the route end — they agree.
   - Press stop: both cursor and map marker disappear.
   - Change speed mid-playback (this stops and replays from `progressRef`): the cursor should resume from the same place, not jump to zero.
   - Navigate away mid-playback and back: no stale cursor.
4. Route **without** elevation data: the "No elevation information available." message still renders and animation plays normally with no errors.
5. Mobile viewport (< 860px): confirm no visual change in either preview or fullscreen.
6. Selector refactor regression check (it touches app-wide components): sign in/out still works (`AppShell`, `MainWrapper`, `auth/callback`), the units toggle still updates the header, route cards, route table, and both the profile axes and route info panel.
7. Optional but cheap: with React DevTools "Highlight updates" on, play the animation and confirm only the chart flashes — not the header, detail panel, or photo gallery. This is the whole reason for the selector work.
