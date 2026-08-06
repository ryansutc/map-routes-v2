# Animation Speed Control — Implementation Plan

## Goal

Replace the hardcoded `durationMs` animation with a user-configurable "points per second" speed setting. A gear icon in the playback control bar opens an MUI Popover with a speed dropdown and context showing estimated playback time and real activity duration.

## Decisions

- Speed options: 10, 50, 100, 200, 500 pts/sec; default 50
- Point count: actual post-`interpolatePath` count (not raw GPS points)
- No localStorage persistence — resets to default each page load
- Mid-playback speed change: continues from current `progress`
- Gear icon: right end of control bar, after progress bar
- Dialog: MUI Popover anchored to gear icon
- Time estimate shows "calculating..." until coords load
- Shows both: playback time estimate AND real activity duration (`duration` field)

## Phase 1 — Backend: Add `track_point_count`

- [ ] Add `track_point_count = models.IntegerField(null=True, blank=True)` to `Route` model
- [ ] Create and run migration
- [ ] In the GPX upload view, count coordinates from the resulting GeoJSON and save to `track_point_count`
- [ ] Expose `track_point_count` in the Route serializer
- [ ] Regenerate frontend types

## Phase 2 — Hook: Replace `durationMs` with `pointsPerSecond`

- [ ] Replace `durationMs` option in `AnimationOptions` with `pointsPerSecond: number` (default 50)
- [ ] Expose `pointCount` (post-interpolation) from the hook so the UI can compute time estimates
- [ ] Compute `durationMs = coords.length / pointsPerSecond * 1000` at play time
- [ ] Extend `play` to accept optional `startProgress: number` so mid-playback speed changes resume correctly
- [ ] Update `$routeId.tsx` call site to pass `pointsPerSecond` instead of `durationMs`

## Phase 3 — UI: Settings Popover

- [ ] Create `AnimationSettingsPopover` component (MUI Popover + Select)
  - Dropdown: 10 / 50 / 100 / 200 / 500 pts/sec
  - Line 1: `~X sec` playback time (or "calculating..." while loading)
  - Line 2: `Actual activity: Xh Xm` from route `duration` field
- [ ] Add gear `IconButton` to the right end of the control bar in `$routeId.tsx`, after the progress bar
- [ ] Wire speed state: when user changes dropdown, if playing → stop and restart from current progress at new speed
- [ ] Pass `pointsPerSecond` down to `useRouteAnimation`

## Files Affected

| File | Change |
|------|--------|
| `django_backend/apps/routes/models.py` | Add `track_point_count` field |
| `django_backend/apps/routes/migrations/` | New migration |
| `django_backend/apps/routes/views.py` (or serializer) | Populate `track_point_count` on upload |
| `django_backend/apps/routes/serializers.py` | Expose field |
| `frontend/src/hooks/useRouteAnimation.ts` | Replace `durationMs` → `pointsPerSecond`, expose `pointCount`, support `startProgress` |
| `frontend/src/routes/routes/$routeId.tsx` | Add gear icon + popover, wire speed state |
| `frontend/src/components/AnimationSettingsPopover.tsx` | New component |
