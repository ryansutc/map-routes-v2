# Timestamped Route Animation Photos — Feature Specification

**Status:** Draft for review  
**Last updated:** 2026-08-03  
**Related implementation plan:**
[animation-photos-plan.md](../plans/animation-photos-plan.md)

## 1. Purpose

Route playback should show photos at the point in the recorded activity when
they were taken. When playback reaches a photo event, the route pauses, the
photo lightbox opens, each photo remains visible for two seconds, and the route
resumes afterward.

The feature must use original GPX point timestamps. It must not infer an
activity timeline from route duration, point index, or distance when those
timestamps are unavailable.

This document is the authoritative statement of required behavior. The
implementation plan describes how the current repository will satisfy it.
GitHub issues and tests should reference the requirement IDs in this spec.

## 2. Normative Language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative:

- **MUST / MUST NOT** identify required behavior.
- **SHOULD / SHOULD NOT** identify the expected behavior unless a documented
  implementation constraint justifies an exception.
- **MAY** identifies optional behavior.

## 3. Goals

- Reproduce the temporal shape of timestamped GPX activities in a compressed
  animation.
- Place photo events using `Photo.taken_at` and the recorded track timeline.
- Allow viewers to skip detected stops without losing photos taken at them.
- Preserve a smooth constant-speed alternative while keeping photo placement
  spatially correct.
- Remain deterministic and recoverable across manual gallery interactions,
  image failures, hidden tabs, setting changes, and route navigation.
- Preserve existing animation for legacy routes without presenting an
  approximate result as exact.
- Keep preprocessing practical for long routes in an ordinary browser.

## 4. Non-goals

- Backfilling point timestamps for routes whose original GPX timestamps were
  discarded.
- Retaining original GPX files after canonical route data has been generated.
- Estimating photo timing from `activity_date / duration` on legacy routes.
- Inferring a route position from a photo's GPS coordinate when its time is
  outside or absent from the recorded route timeline.
- User-adjustable stop radius or stop-duration thresholds in the first version.
- Interactive progress-bar seeking or route editing.
- Changing the normal, manually opened route photo gallery when no animation
  session is active.
- Depending on a paid network service for timezone lookup.

## 5. Glossary

### 5.1 Recorded point

A coordinate from the source GPX track with an associated absolute timestamp.

### 5.2 Track segment

An ordered GPX `<trkseg>`. Segment boundaries represent a discontinuity in the
recording and must not automatically be treated as a traversed line.

### 5.3 Activity time

The absolute time represented by GPX point timestamps.

### 5.4 Original elapsed time

Elapsed activity time since the first recorded point, including stops and
recording gaps.

### 5.5 Moving elapsed time

Original elapsed time with detected stop intervals and skipped recording gaps
collapsed.

### 5.6 Playback time

Foreground wall-clock time spent advancing the route animation. Time spent in
photo pauses, manual gallery pauses, or while the document is hidden is not
playback time.

### 5.7 Target route duration

The requested amount of playback time for the route itself, excluding photo
display and loading pauses.

### 5.8 Timestamp-capable route

A route whose complete animated track has valid, ordered point timestamps and
can therefore support recorded-time playback and timed photos.

### 5.9 Legacy route

A route that does not satisfy the timestamp-capable contract. This includes
existing routes whose point timestamps were discarded and newly uploaded GPX
tracks with incomplete or invalid timing data.

### 5.10 Detected stop

A derived activity interval during which recorded positions remain within the
configured stay radius for at least the configured minimum duration.

### 5.11 Stop anchor

A stable representative coordinate for a detected stop. It suppresses visible
GPS jitter while the marker waits at the stop.

### 5.12 Unknown recording gap

The interval between separated GPX segments for which the recorded route
contains no defensible position.

### 5.13 Photo event

An eligible photo mapped from `taken_at` to an exact position in a route's
recorded timeline and to the corresponding cumulative route distance.

### 5.14 Photo event group

One or more photo events displayed in one uninterrupted automatic lightbox
session.

### 5.15 Automatic lightbox session

A lightbox opened by route playback and controlled by photo event timers.

### 5.16 Manual lightbox session

A lightbox controlled by the viewer. It has no automatic image-change or close
timer.

## 6. Route Data Requirements

### 6.1 Canonical timed track

- **RAP-DATA-001:** Route generation MUST preserve one timestamp aligned
  one-to-one with every animated GPX coordinate.
- **RAP-DATA-002:** Route generation MUST preserve GPX track segment boundaries.
- **RAP-DATA-003:** Canonical route data MUST represent each segment without
  inventing geometry between segment endpoints.
- **RAP-DATA-004:** Persisted point timestamps MUST be absolute, timezone-aware,
  and precise enough to preserve the source GPX ordering.
- **RAP-DATA-005:** The canonical route representation MUST remain valid GeoJSON;
  timing metadata MUST live in feature properties rather than changing the
  meaning of coordinate elements.
- **RAP-DATA-006:** The timestamp array for a segment MUST contain exactly the
  same number of entries as that segment's coordinate array.
- **RAP-DATA-007:** Canonical route GeoJSON stored with the route MUST be the
  source used to build the animation timeline.
- **RAP-DATA-008:** Playback MUST NOT depend on ArcGIS or another map host
  preserving arbitrary timing properties.
- **RAP-DATA-009:** A map-hosted copy MAY omit timing properties when those
  properties are not required for map rendering.

The expected canonical feature shape is:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-123.1, 49.2, 120.0],
      [-123.2, 49.3, 125.0]
    ]
  },
  "properties": {
    "coordinate_times": [
      "2026-08-01T16:00:00Z",
      "2026-08-01T16:00:05Z"
    ]
  }
}
```

### 6.2 Timestamp capability validation

- **RAP-DATA-010:** Every animated point MUST have a valid timestamp for the
  route to be timestamp-capable.
- **RAP-DATA-011:** Timestamps MUST be globally nondecreasing in track playback
  order, including across segment boundaries.
- **RAP-DATA-012:** Equal consecutive timestamps MUST be accepted and represent
  instantaneous movement between their coordinates.
- **RAP-DATA-013:** A missing, malformed, or backward timestamp MUST classify
  the entire route as legacy for playback purposes.
- **RAP-DATA-014:** Invalid timing data MUST NOT prevent the route from being
  uploaded and used with legacy animation.
- **RAP-DATA-015:** `activity_date` MUST reflect the first valid track timestamp.
- **RAP-DATA-016:** Recorded activity duration MUST reflect the difference
  between the first and last valid track timestamps, including stopped time and
  segment gaps.

### 6.3 Route retrieval

- **RAP-DATA-017:** Route detail retrieval MUST provide the canonical timed
  track to authorized viewers of a timestamp-capable route.
- **RAP-DATA-018:** Route collection/list retrieval SHOULD NOT transfer full
  timed GeoJSON when the consuming list UI does not require it.
- **RAP-DATA-019:** Existing access rules for public, private, and owner-only
  route data MUST continue to apply.

## 7. Track Timeline Requirements

### 7.1 Recorded-time positioning

- **RAP-TIME-001:** At every recorded point timestamp, recorded-time playback
  MUST place the marker at that point's recorded coordinate.
- **RAP-TIME-002:** Between two timed points in the same segment, marker position
  MUST be interpolated according to elapsed activity time between those points.
- **RAP-TIME-003:** Playback MUST NOT interpolate position across an unknown
  segment gap.
- **RAP-TIME-004:** A zero-duration pair of points MUST resolve deterministically
  without division-by-zero or a stalled session.
- **RAP-TIME-005:** Timeline construction MUST retain both original elapsed time
  and derived moving elapsed time.

### 7.2 Distance positioning

- **RAP-TIME-006:** Cumulative route distance MUST be computed within segments.
- **RAP-TIME-007:** Unknown segment gaps MUST add no fictional distance.
- **RAP-TIME-008:** Constant-speed playback MUST interpolate position by
  cumulative route distance.
- **RAP-TIME-009:** A timed photo in constant-speed playback MUST trigger at the
  cumulative distance of its timestamp-derived route position.

### 7.3 Progress semantics

- **RAP-TIME-010:** The animation MUST maintain separate timeline/playback and
  spatial-distance progress values.
- **RAP-TIME-011:** The control-bar progress indicator MUST use progress through
  the selected playback timeline.
- **RAP-TIME-012:** Map/elevation synchronization MUST use the marker's spatial
  distance progress, not recorded-time fraction.

## 8. Stop and Segment-gap Requirements

### 8.1 Stop detection

- **RAP-STOP-001:** Stop detection MUST be derived from canonical timed track
  data in frontend memory.
- **RAP-STOP-002:** The initial stop heuristic MUST identify a stop when the
  route remains within a 20-metre stay area for at least 90 seconds.
- **RAP-STOP-003:** The threshold values MUST be named code constants and MUST
  NOT be user-adjustable in the first version.
- **RAP-STOP-004:** A detected stop MUST have a stable anchor that prevents
  visible marker jitter.
- **RAP-STOP-005:** Stop derivation MUST NOT alter or discard canonical route
  coordinates or timestamps.

### 8.2 Including and skipping stops

- **RAP-STOP-006:** With stop skipping disabled, detected stop duration MUST
  remain part of the compressed playback timeline.
- **RAP-STOP-007:** With stop skipping disabled, the marker SHOULD remain at the
  stable stop anchor for the detected interval.
- **RAP-STOP-008:** With stop skipping enabled, detected stop duration MUST be
  removed from moving elapsed time.
- **RAP-STOP-009:** Enabling stop skipping MUST NOT make photos taken during a
  detected stop ineligible.
- **RAP-STOP-010:** Photos taken during one collapsed stop MUST map to that stop's
  anchor and remain ordered by original `taken_at`.
- **RAP-STOP-011:** `Skip detected stops` MUST default to enabled and persist as
  a viewer preference.
- **RAP-STOP-012:** Stop skipping MUST only affect recorded-time playback;
  constant-speed playback already excludes stopped duration by definition.

### 8.3 Segment gaps

- **RAP-GAP-001:** Consecutive segment endpoints within the stop-detection area
  MAY form one detected stop.
- **RAP-GAP-002:** Separated consecutive segment endpoints MUST form an unknown
  recording gap.
- **RAP-GAP-003:** With stop skipping disabled, playback MUST hold at the last
  known position through an unknown gap and jump to the next segment when its
  first timestamp is reached.
- **RAP-GAP-004:** With stop skipping enabled, playback MUST collapse the unknown
  gap and jump directly to the next segment.
- **RAP-GAP-005:** A photo strictly inside an unknown gap MUST be excluded from
  automatic playback.
- **RAP-GAP-006:** A photo exactly on a recorded segment boundary remains
  eligible when its position can be resolved to the boundary point.

## 9. Playback Modes and Settings

### 9.1 Timestamp-capable routes

- **RAP-MODE-001:** Timestamp-capable routes MUST offer `Recorded time` and
  `Constant speed` playback modes.
- **RAP-MODE-002:** `Recorded time` MUST be the default for timestamp-capable
  routes.
- **RAP-MODE-003:** The former GPS-point/index mode SHOULD NOT be offered on
  timestamp-capable routes.
- **RAP-MODE-004:** Timed photos MUST be supported in both recorded-time and
  constant-speed modes.

### 9.2 Legacy routes

- **RAP-MODE-005:** Legacy routes MUST retain their existing GPS-point/index and
  constant-speed playback modes.
- **RAP-MODE-006:** Legacy routes MUST NOT offer recorded-time playback.
- **RAP-MODE-007:** Legacy routes MUST NOT automatically display photos.
- **RAP-MODE-008:** Legacy routes MUST NOT synthesize photo events from route
  start time and total duration.

### 9.3 Target duration

- **RAP-MODE-009:** Playback speed MUST be expressed as target route duration,
  not points per second.
- **RAP-MODE-010:** The available target durations MUST initially be 10, 20, 30,
  60, and 120 seconds.
- **RAP-MODE-011:** The default target route duration MUST be 20 seconds.
- **RAP-MODE-012:** Target route duration MUST exclude photo display time, image
  loading time, manual gallery time, and hidden-document time.
- **RAP-MODE-013:** The selected target duration MUST persist as a viewer
  preference.

### 9.4 Photo and stop preferences

- **RAP-MODE-014:** Animation settings MUST include `Show timed photos`.
- **RAP-MODE-015:** `Show timed photos` MUST default to enabled and persist as a
  viewer preference.
- **RAP-MODE-016:** Timed-photo and recorded-time controls MUST be unavailable on
  legacy routes with a concise explanation.
- **RAP-MODE-017:** Settings that do not apply to the selected playback mode
  SHOULD be hidden or disabled rather than silently ignored.

### 9.5 Live setting changes

- **RAP-MODE-018:** Applicable animation setting changes MUST take effect during
  active playback without resetting the route to its start.
- **RAP-MODE-019:** Duration changes MUST preserve the current route position.
- **RAP-MODE-020:** Mode changes MUST rebase through the current track position,
  timestamp, and cumulative distance.
- **RAP-MODE-021:** Stop-setting changes MUST map the current original activity
  time into the rebuilt moving timeline.
- **RAP-MODE-022:** Photo-setting changes MUST only rebuild unconsumed future
  photo events.

## 10. Photo Timestamp Requirements

### 10.1 Extraction and timezone resolution

- **RAP-PHOTO-001:** `Photo.taken_at` MUST be exposed in route photo API data.
- **RAP-PHOTO-002:** A photo timestamp with an explicit embedded UTC offset MUST
  use that offset.
- **RAP-PHOTO-003:** When the photo timestamp has no offset and the photo has GPS,
  timezone MUST be inferred from the photo coordinate.
- **RAP-PHOTO-004:** When the photo has no GPS, timezone SHOULD be inferred from
  the route's first coordinate.
- **RAP-PHOTO-005:** Location-based inference MUST apply the correct historical
  IANA timezone offset, including daylight-saving rules for the photo date.
- **RAP-PHOTO-006:** Timezone inference MUST use an offline lookup and MUST NOT
  require a paid network service.
- **RAP-PHOTO-007:** When no timezone can be resolved confidently, `taken_at`
  MUST remain unset rather than being assumed to be UTC.
- **RAP-PHOTO-008:** Persisted `taken_at` values MUST be timezone-aware and
  normalized consistently for comparison with GPX times.

### 10.2 Owner correction

- **RAP-PHOTO-009:** A route owner MUST be able to set, correct, or clear a
  photo's `taken_at` value.
- **RAP-PHOTO-010:** The editor MUST show the local timezone used to interpret a
  manually entered value.
- **RAP-PHOTO-011:** The editor SHOULD prefer the photo-inferred timezone and
  fall back to the route-start timezone.
- **RAP-PHOTO-012:** Saving an out-of-range value MUST be allowed because the
  photo remains valid gallery content.
- **RAP-PHOTO-013:** Only the route owner may modify `taken_at`; existing photo
  ownership rules MUST continue to apply.

## 11. Photo Eligibility and Event Mapping

### 11.1 Eligibility

- **RAP-EVENT-001:** A photo MUST have a resolved `taken_at` to be eligible.
- **RAP-EVENT-002:** A photo before the first route timestamp MUST be excluded.
- **RAP-EVENT-003:** A photo after the last route timestamp MUST be excluded.
- **RAP-EVENT-004:** Out-of-range photo times MUST NOT be clamped or accepted
  through a tolerance window.
- **RAP-EVENT-005:** A photo strictly inside an unknown gap MUST be excluded.
- **RAP-EVENT-006:** A photo during a detected stop MUST remain eligible.
- **RAP-EVENT-007:** An ineligible photo MUST remain available in the normal
  route gallery.

### 11.2 Exact event position

- **RAP-EVENT-008:** Each eligible `taken_at` MUST resolve to the exact recorded
  point or time-interpolated position within a segment.
- **RAP-EVENT-009:** Each eligible event MUST also resolve to cumulative route
  distance so it can run in constant-speed mode.
- **RAP-EVENT-010:** The marker MUST be at the event's resolved route position
  when its photo becomes current.

### 11.3 Event grouping

- **RAP-EVENT-011:** Photos with identical resolved timestamps MUST be grouped.
- **RAP-EVENT-012:** Photos mapped to one collapsed stop MUST be grouped.
- **RAP-EVENT-013:** Otherwise, consecutive events separated by no more than two
  seconds of compressed route playback MUST be grouped.
- **RAP-EVENT-014:** The two-second grouping window MUST be a named code constant.
- **RAP-EVENT-015:** A group MUST be ordered by original `taken_at`, using stable
  photo ID as the tie-breaker.
- **RAP-EVENT-016:** When grouped photos have different event positions, the
  marker MUST move to each photo's resolved position as that photo becomes
  current.

## 12. Automatic Photo Display Requirements

### 12.1 Display timing and loading

- **RAP-DISPLAY-001:** Route playback MUST pause before an automatic lightbox
  opens.
- **RAP-DISPLAY-002:** Each automatically displayed photo MUST remain visibly
  loaded for two seconds.
- **RAP-DISPLAY-003:** Loading time MUST NOT count toward the two visible seconds.
- **RAP-DISPLAY-004:** The next upcoming event group SHOULD be preloaded
  opportunistically without eagerly downloading the entire gallery.
- **RAP-DISPLAY-005:** A failed image MUST be skipped without preventing later
  photos or route playback.
- **RAP-DISPLAY-006:** Image loading MUST have a bounded timeout so a stalled
  request cannot pause playback indefinitely.
- **RAP-DISPLAY-007:** After the final successfully displayed photo in a group,
  the lightbox MUST close and route playback MUST resume.

### 12.2 Route boundaries

- **RAP-DISPLAY-008:** A photo event at the route start MUST display before
  marker movement begins.
- **RAP-DISPLAY-009:** A photo event at the route end MUST display before the
  playback session becomes completed.

## 13. Playback and Lightbox State Requirements

### 13.1 Animation lifecycle

- **RAP-STATE-001:** The animation MUST distinguish idle, playing, paused, and
  completed states.
- **RAP-STATE-002:** Pauses MUST preserve route position and event cursor.
- **RAP-STATE-003:** Pause reasons MUST compose; playback may resume only when
  all active pause reasons have cleared.
- **RAP-STATE-004:** Photo display, manual gallery viewing, and a hidden document
  MUST be independent pause reasons.
- **RAP-STATE-005:** Stopping playback MUST reset route progress, hide the marker,
  close any animation-owned lightbox, cancel timers, and end the session.
- **RAP-STATE-006:** Replaying after stop or completion MUST make all eligible
  photo groups available again.
- **RAP-STATE-007:** Navigating away or unmounting MUST cancel animation frames,
  timers, preload callbacks, and pending automatic transitions.

### 13.2 Hidden document

- **RAP-STATE-008:** Route clocks and photo timers MUST pause while the document
  is hidden.
- **RAP-STATE-009:** Playback MUST resume from the same state when the document
  becomes visible and no other pause reason remains.
- **RAP-STATE-010:** Hidden time MUST NOT cause photo events to be skipped or
  photo display time to be consumed.

### 13.3 Automatic lightbox interaction

- **RAP-STATE-011:** Manually closing an automatic lightbox MUST consume the
  remainder of its current group and resume playback.
- **RAP-STATE-012:** Consumed photos MUST NOT reopen during the current session.
- **RAP-STATE-013:** Manual previous/next interaction during an automatic session
  MUST cancel automatic timers and transfer the lightbox to manual control.
- **RAP-STATE-014:** After manual takeover, the viewer MUST be able to navigate
  the full route gallery.
- **RAP-STATE-015:** Playback MUST remain paused until the manually controlled
  lightbox closes.
- **RAP-STATE-016:** An animation-paused lightbox MUST provide an explicit
  `Stop playback` action distinct from close/resume.

### 13.4 Manually opened photos

- **RAP-STATE-017:** Opening a photo manually while route playback is active
  MUST pause playback.
- **RAP-STATE-018:** Closing that manual lightbox MUST resume only if playback
  had been active before it opened.
- **RAP-STATE-019:** Closing a manual lightbox MUST NOT start an idle or stopped
  animation.

## 14. User-interface Requirements

- **RAP-UI-001:** Timed-photo playback MUST work in desktop route playback.
- **RAP-UI-002:** Timed-photo playback MUST work in mobile fullscreen-map
  playback.
- **RAP-UI-003:** The non-interactive mobile map preview MUST NOT start playback
  or automatic photo display.
- **RAP-UI-004:** The lightbox MUST adapt to supported viewport sizes without
  obscuring its close, navigation, or stop actions.
- **RAP-UI-005:** Lightbox actions MUST remain keyboard accessible; Escape MUST
  perform the session's normal close behavior.
- **RAP-UI-006:** Animation settings SHOULD show how many route photos are
  eligible, for example `8 of 10 photos will appear`.
- **RAP-UI-007:** The owner photo editor MUST show whether each photo is included
  and, when excluded, a specific reason.
- **RAP-UI-008:** Exclusion reasons MUST distinguish at least legacy route,
  missing/unresolved time, before route, after route, and unknown gap.
- **RAP-UI-009:** Detailed eligibility diagnostics SHOULD remain owner-facing so
  the public route view stays uncluttered.
- **RAP-UI-010:** Map interaction locking and elevation-hover suppression MUST
  remain active for the complete playback session, including automatic photo
  pauses.

## 15. Performance and Reliability Requirements

- **RAP-PERF-001:** Timed-track normalization, cumulative-distance construction,
  and stop detection MUST be `O(n)` in track-point count.
- **RAP-PERF-002:** Derived track and photo-event data MUST be reused until route
  data or relevant settings change.
- **RAP-PERF-003:** Per-animation-frame work MUST NOT scan the full track or full
  photo list.
- **RAP-PERF-004:** Position lookup SHOULD use binary search or a monotonic
  forward cursor.
- **RAP-PERF-005:** Event scheduling SHOULD use a forward event cursor so each
  event is processed at most once per session unless settings require a rebuild.
- **RAP-PERF-006:** One failed image, malformed photo, or ineligible event MUST
  NOT stop otherwise valid route playback.
- **RAP-PERF-007:** Route list performance MUST not regress by transferring timed
  geometry that list views do not consume.
- **RAP-PERF-008:** The implementation MUST include a large synthetic-track test
  that guards against accidentally quadratic preprocessing.

## 16. Compatibility Requirements

- **RAP-COMPAT-001:** Existing legacy routes MUST continue to animate.
- **RAP-COMPAT-002:** Existing route photos MUST remain manually viewable.
- **RAP-COMPAT-003:** No data migration may claim to reconstruct discarded GPX
  point timestamps.
- **RAP-COMPAT-004:** Incompatible persisted animation settings MUST fall back to
  the current route's supported default without breaking playback.
- **RAP-COMPAT-005:** Existing route access control, ownership, and visibility
  behavior MUST remain unchanged.
- **RAP-COMPAT-006:** Existing elevation-profile animation MUST remain spatially
  synchronized in both recorded-time and constant-speed modes.

## 17. Acceptance Scenarios

### AS-01: Recorded-time playback

**Covers:** `RAP-DATA-001`–`016`, `RAP-TIME-001`–`005`, `RAP-MODE-001`–`004`

Given a valid multi-point GPX whose points have ordered timestamps, when the
viewer starts recorded-time playback, then the marker reaches every recorded
point at the corresponding fraction of the compressed activity timeline.

### AS-02: Include and skip a long stop

**Covers:** `RAP-STOP-001`–`012`

Given a route that stays inside the stop area for longer than 90 seconds, when
stop skipping is disabled, then playback waits at a stable stop anchor. When
stop skipping is enabled, the wait is removed and photos from the stop still
display at the anchor in chronological order.

### AS-03: Constant-speed timed photos

**Covers:** `RAP-TIME-006`–`009`, `RAP-MODE-004`, `RAP-EVENT-008`–`010`

Given an eligible photo on a timestamp-capable route, when constant-speed
playback reaches the cumulative distance derived from its `taken_at`, then the
marker is at the timestamp-derived route position and the photo opens.

### AS-04: Legacy route

**Covers:** `RAP-DATA-013`–`014`, `RAP-MODE-005`–`008`, `RAP-COMPAT-001`–`003`

Given a route without complete valid point timestamps, when it is viewed, then
legacy animation remains available, recorded-time controls explain their
unavailability, and no photo opens automatically.

### AS-05: Recording gap

**Covers:** `RAP-GAP-001`–`006`

Given two separated GPX segments, when playback crosses their boundary, then no
connecting route is interpolated. A photo strictly inside the gap is excluded,
while a photo at a resolvable boundary remains eligible.

### AS-06: Photo timezone resolution and correction

**Covers:** `RAP-PHOTO-001`–`013`

Given a photo with local EXIF time and GPS but no embedded offset, when it is
uploaded, then the correct historical local timezone is applied and an aware
`taken_at` is stored. The owner can later correct or clear it using an editor
that displays the applied timezone.

### AS-07: Photo eligibility

**Covers:** `RAP-EVENT-001`–`010`, `RAP-UI-006`–`009`

Given photos before, during, and after a route plus a photo inside an unknown
gap, when eligibility is calculated, then only resolvable in-range photos are
scheduled and the owner sees a specific status for every exclusion.

### AS-08: Automatic group

**Covers:** `RAP-EVENT-011`–`016`, `RAP-DISPLAY-001`–`009`

Given several events within two seconds of compressed playback, when the first
event is reached, then one lightbox session shows them chronologically for two
loaded seconds each, moves the marker to each event position, closes, and
resumes playback.

### AS-09: Manual takeover and stopping

**Covers:** `RAP-STATE-011`–`019`

Given an automatic lightbox session, when the viewer navigates manually, then
automatic timers stop and the full gallery becomes manually controlled. Closing
resumes the prior animation, while `Stop playback` resets it.

### AS-10: Loading failure

**Covers:** `RAP-DISPLAY-002`–`007`, `RAP-PERF-006`

Given a group containing a slow image and a failed image, then visible-time
counting begins only after successful load, the failed image is skipped after a
bounded attempt, and playback cannot remain deadlocked.

### AS-11: Hidden document and composed pauses

**Covers:** `RAP-STATE-001`–`010`

Given playback or photo display is active when the document becomes hidden,
then all relevant clocks pause. Visibility alone does not resume playback while
another pause reason remains, and no photo event is skipped.

### AS-12: Live setting changes

**Covers:** `RAP-MODE-018`–`022`

Given active playback, when duration, playback mode, stop skipping, or timed
photo preference changes, then the session rebases from its current route
position without replaying consumed groups or resetting to the start.

### AS-13: Responsive playback and elevation

**Covers:** `RAP-TIME-010`–`012`, `RAP-UI-001`–`010`, `RAP-COMPAT-006`

Given desktop or mobile fullscreen playback, then timed photos behave
consistently and the elevation cursor remains aligned to marker distance even
when recorded-time progress is nonlinear in distance.

### AS-14: Long route

**Covers:** `RAP-PERF-001`–`008`

Given a large synthetic timestamped route, then preprocessing remains linear,
derived data is reused, and animation-frame work does not grow linearly with
total point count.

## 18. Completion Standard

The feature is complete when:

1. Every MUST requirement is implemented or explicitly superseded by an
   accepted spec revision.
2. Each acceptance scenario has automated coverage where practical and a
   documented manual check where browser/map behavior prevents reliable unit
   coverage.
3. GitHub implementation issues reference the requirement IDs they satisfy.
4. The implementation plan contains a traceability mapping from spec
   requirements to implementation phases and issues.
5. Backend tests and frontend typecheck, lint, unit tests, and production build
   pass.
