# Timestamped Route Animation Photos — Verification Matrix

This matrix is the completion evidence for
[`timestamped-route-animation-photos.md`](../specs/timestamped-route-animation-photos.md).
Pure data, timeline, and session behavior is automated. ArcGIS rendering,
responsive layout, browser image loading, and focus behavior use the manual
checks below because unit tests cannot reliably exercise those interfaces.

## Automated acceptance coverage

| Scenario | Automated evidence | Browser/map check |
| --- | --- | --- |
| AS-01 — Recorded-time playback | `test_parse_gpx_preserves_tracks_segments_and_aligned_absolute_times`, `buildRouteTrack capability`, and `reaches recorded observations at their compressed timeline fractions` | M-01 |
| AS-02 — Include and skip a long stop | `TimedTrack stops`, `includes or collapses detected stops only in recorded-time mode`, and `maps photos in a detected stop to its stable anchor and distance` | M-01 |
| AS-03 — Constant-speed timed photos | `interpolates by cumulative within-segment distance` and the recorded/distance cases of `pauses at the exact event cursor` | M-01 |
| AS-04 — Legacy route | legacy capability cases in `timedTrack.test.ts`, `retains GPS-point playback for legacy routes`, and store migration tests | M-02 |
| AS-05 — Recording gap | `adds no distance or interpolation across a separated segment gap` and eligibility boundary/gap cases in `timedPhotoEvents.test.ts` | M-01 |
| AS-06 — Photo timezone resolution and correction | `PhotoTimestampTests` and the owner photo timestamp cases in `EditingApiTests` | M-03 |
| AS-07 — Photo eligibility | `classifyTimedPhotoEligibility` and `planTimedPhotoEvents` test suites | M-03 |
| AS-08 — Automatic group | grouping tests in `timedPhotoEvents.test.ts` and `shows a group in order and moves the marker to every photo cursor` | M-01, M-04 |
| AS-09 — Manual takeover and stopping | manual session, takeover, composed pause, and stop cases in `timedPhotoPlayback.test.ts` | M-04, M-05 |
| AS-10 — Loading failure | `skips failed and timed-out images without deadlocking the group` | M-04 |
| AS-11 — Hidden document and composed pauses | composed-pause tests in `routeAnimation.test.ts` plus hidden loading/visible-time tests in `timedPhotoPlayback.test.ts` | M-05 |
| AS-12 — Live setting changes | `rebases live duration and stop-setting changes through the cursor` and coordinator enable/grouping-setting cases | M-01 |
| AS-13 — Responsive playback and elevation | separate playback/distance progress tests, exact photo cursor tests, and active-session lock-state coverage | M-01, M-06 |
| AS-14 — Long route | `preprocesses a large synthetic track through the public interface`, forward event-cursor coordinator tests, and route-list payload tests | M-07 |

## Manual test data

Use an owner account and a public viewer account. Prepare:

- a multi-segment timed route with nonuniform timestamps, elevation, a stop of
  at least 90 seconds, and a separated recording gap;
- eligible photos at the route start, stop, moving portions, and route end,
  including a group whose compressed separation is at most two seconds;
- missing-time, before-route, after-route, and inside-gap photos;
- one image URL that fails and one that can be throttled in browser devtools;
- a legacy route with photos and no complete coordinate timestamp array;
- a long timed route representative of the largest expected GPX upload.

## Browser and map checks

Run the checks at a desktop viewport (at least 1280 × 720), a mobile viewport
(390 × 844), and a narrow supported viewport (320 × 568). Repeat M-01 in both
2D and 3D map modes.

### M-01 — Timed playback modes, stops, gaps, and live settings

1. Start recorded-time playback on the timed route and verify the marker's
   nonuniform movement matches the recorded timeline.
2. Toggle stop skipping, target duration, timed photos, and playback mode while
   active. Verify the marker does not reset or jump backward and consumed photo
   groups do not reopen.
3. Verify the marker holds/jumps at segment gaps without drawing or traversing
   a connecting line. Confirm inside-gap photos do not open.
4. Run constant-speed playback and confirm each photo opens with the marker at
   its timestamp-derived position.

### M-02 — Legacy compatibility and mobile preview

1. Confirm a legacy route offers GPS-point and constant-speed playback, explains
   why recorded time and timed photos are unavailable, and never opens a photo
   automatically.
2. At mobile width, remain on the tappable map preview for at least the selected
   target duration. Confirm it exposes no playback controls and starts neither
   marker movement nor a lightbox.
3. Open the fullscreen map and confirm playback controls become available.
4. During active timed playback and a photo pause, confirm return to the
   non-interactive preview is unavailable. Stop playback, return to the preview,
   and confirm no marker movement or automatic lightbox continues there.
5. Open every legacy-route photo manually from the gallery.

### M-03 — Owner correction and eligibility explanations

1. In the owner photo editor, verify the inferred/editing timezone is visible.
2. Correct and clear a timestamp, including an out-of-range value, and save.
3. Confirm each photo shows the expected included state or the specific legacy,
   unresolved, before-route, after-route, or unknown-gap explanation.
4. View the route as a non-owner and confirm detailed diagnostics are absent.

### M-04 — Responsive automatic lightbox and failures

1. Trigger a multi-photo automatic group at each viewport size. Confirm the
   route pauses before opening and each successful image remains visible for
   two seconds after loading.
2. Confirm close, previous, next, and `Stop playback` remain visible without
   scrolling, and photo titles/counts do not cover those actions.
3. Throttle one image and fail another. Confirm loading time is excluded, the
   failed image is skipped after a bounded wait, later photos display, and the
   route resumes.
4. Confirm route-start photos open before movement and route-end photos open
   before completion.

### M-05 — Keyboard, takeover, visibility, and cleanup

1. Tab through every visible lightbox action and activate it with the keyboard.
   Use Left/Right Arrow to navigate and Escape to perform the same close/resume
   behavior as the close button.
2. Navigate during an automatic group, confirm manual takeover exposes the full
   gallery, and verify playback remains paused until close.
3. Hide the document during route movement, loading, and loaded-photo display.
   Restore it and verify no clock advanced, no event was skipped, and any other
   active pause still holds.
4. Stop playback and navigate away during a photo. Confirm the marker/lightbox
   disappear and no stale timer or image callback reopens them.

### M-06 — Map lock and spatial elevation synchronization

1. During movement and an automatic photo pause, attempt mouse, touch, wheel,
   keyboard, zoom-widget, and elevation-chart interactions. Confirm the map
   cannot move and elevation hover cannot replace the animation marker.
   Focus an ArcGIS widget before starting and confirm playback removes its focus
   and prevents keyboard activation until the session ends.
2. Verify the elevation cursor follows marker distance rather than control-bar
   time in recorded-time mode, especially around the long stop.
3. Repeat in constant-speed mode and in desktop and mobile fullscreen layouts.
4. Stop playback and confirm map and elevation interactions are restored.

### M-07 — Long-route responsiveness

1. Load and play the long route in both playback modes while recording the
   browser performance profile.
2. Confirm preprocessing finishes without a long-task cascade, controls remain
   responsive, and frame work does not visibly degrade as the session advances.
3. Confirm the route list response contains no canonical timed geometry in the
   browser network panel; detail retrieval still contains it.

## Verification commands

```bash
cd django_backend
pipenv run python manage.py test
pipenv run ruff check .

cd ../frontend
pnpm test --run
pnpm typecheck
pnpm lint
pnpm build
```

Record the browser, operating system, viewport sizes, and result of each M-check
in issue #52 or its pull request when executing the manual pass.
