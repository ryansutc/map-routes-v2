# Timestamped Route Animation Photos — Implementation Plan

**Status:** Proposed; ready for issue decomposition after spec review  
**Behavioral source of truth:**
[Timestamped Route Animation Photos — Feature Specification](../specs/timestamped-route-animation-photos.md)  
**Architecture decisions:**

- [Canonical Timed Route Data and Derived Playback State](../adr/canonical-timed-route-data-and-derived-playback-state.md)
- [Strict Legacy Fallback for Timestamped Playback](../adr/strict-legacy-fallback-for-timestamped-playback.md)

## Document Scope

This plan describes how the current repository can implement the specification.
It does not duplicate product requirements or ADR rationale.

Precedence is:

1. The specification governs observable behavior and acceptance.
2. Accepted ADRs govern durable architecture.
3. This plan governs the current implementation sequence and may evolve with
   the code.

## Current-code Gaps

- The GPX parser flattens track segments and discards point timestamps.
- The parse endpoint uploads the same GeoJSON to ArcGIS that it returns for
  route creation.
- Route.geojson exists, but animation refetches and uses the ArcGIS copy.
- Animation is point/distance-driven, points-per-second based, and lacks true
  pause/resume.
- One animation progress value is incorrectly shared by playback controls and
  the spatial elevation cursor.
- Photo.taken_at is stored but absent from serialized route photos and generated
  frontend types.
- EXIF camera-local time can currently be treated as UTC.
- The lightbox has no automatic-session or animation coordination model.
- Route lists transfer full GeoJSON for every route.

## Target Shape

~~~text
GPX parser
  +--> canonical segmented/timed GeoJSON --> Route.geojson
  +--> geometry-only GeoJSON ------------> ArcGIS

Route.geojson
  --> TimedTrack domain model
        +--> animation engine --> playback and distance progress
        +--> photo event plan --> playback coordinator --> lightbox
~~~

The TimedTrack layer owns pure validation, time/distance indexes, stops, gaps,
and interpolation. ArcGIS objects stay in map adapters. React/session state and
timers stay out of the domain utilities.

The animation engine exposes explicit idle, playing, paused, and completed
states; composable pause reasons; separate playback and distance progress; and
a current track cursor. The photo coordinator owns event consumption, preload
intent, timers, pause leases, manual takeover, and stale-session guards.

See the route-data ADR for why canonical observations are persisted while
playback timelines are derived.

## API and State Migration

No route schema migration is expected because Route.geojson and Photo.taken_at
already exist.

- New valid GPX uploads receive canonical segmented/timed GeoJSON.
- ArcGIS receives a geometry-only rendering copy.
- Existing and invalid-timestamp routes remain legacy; no timestamps are
  synthesized.
- Route list/detail serializers split so lists omit full GeoJSON.
- Photo serializers expose aware taken_at values.
- Owner photo PATCH accepts title and taken_at only.
- OpenAPI and generated frontend types change with the serializers.

Version the persisted Zustand store:

- Replace animationSpeed with animationDurationSec, defaulting migrated users
  to 20 seconds.
- Add skipDetectedStops and showTimedPhotos, both defaulting to true.
- Preserve a supported legacy mode and resolve incompatible persisted modes to
  the current route's default.

The strict compatibility rules are defined by the legacy ADR.

## Work Packages

Each work package is intended to become one GitHub issue or a small issue group.
Issues should link spec requirements rather than copy them.

| Work package | Deliverable | Primary traceability |
| --- | --- | --- |
| WP1 — Timed route API | New GPX uploads preserve segments/timestamps; ArcGIS gets geometry only; route lists become lightweight | RAP-DATA-001–019, RAP-COMPAT-001–003 |
| WP2 — TimedTrack domain | Pure validation, capability, time/distance interpolation, stops, gaps, and large-track coverage | RAP-TIME-001–012, RAP-STOP-001–005, RAP-GAP-001–006, RAP-PERF-001–004/008 |
| WP3 — Recorded-time playback | Canonical GeoJSON input, playback state machine, target duration, legacy modes, separate progress channels | RAP-MODE-001–013, RAP-STATE-001–010, RAP-COMPAT-004–006 |
| WP4 — Stops and live modes | Skip-stops, constant-speed mapping, live setting rebases, persisted preference migration | RAP-STOP-006–012, RAP-MODE-014–022 |
| WP5 — Photo time correctness | Serialized aware times, EXIF offsets, offline timezone inference, owner correction UI | RAP-PHOTO-001–013 |
| WP6 — Basic timed-photo slice | Eligibility, one event, pause/load/display/resume, constant-speed event mapping | RAP-EVENT-001–010, RAP-DISPLAY-001–009 |
| WP7 — Interaction and resilience | Grouping, manual takeover, explicit stop, composed pauses, preload/failure handling | RAP-EVENT-011–016, RAP-STATE-011–019, RAP-PERF-005–006 |
| WP8 — Diagnostics and hardening | Owner eligibility feedback, legacy explanations, mobile, accessibility, cleanup, regression verification | RAP-UI-001–010, RAP-PERF-007, RAP-COMPAT-004–006 |

### Dependency order

~~~text
WP1 --> WP2 --> WP3 --> WP4
  |       |               |
  v       +---------------+--> WP6 --> WP7 --> WP8
 WP5 ---------------------+
~~~

WP1 and WP5 can proceed independently. WP2 depends on the agreed timed GeoJSON
contract, but its pure fixtures can be developed before the backend is merged.
WP6 requires the track cursor from WP3/WP4 and trustworthy photo times from WP5.

### Primary files by work package

- **WP1:** django_backend/apps/routes/gpx_utils.py, views.py, serializers.py,
  test_routes.py, and generated frontend schema artifacts.
- **WP2:** new frontend timed-track utilities/tests and
  frontend/src/hooks/useElevationProfile.ts.
- **WP3/WP4:** frontend/src/hooks/useRouteAnimation.ts, animation utilities and
  tests, RouteAnimationController, RouteAnimationControls,
  AnimationSettingsPopover, ElevationProfile, and the Zustand store.
- **WP5:** backend photo views/serializers/tests, the photo editor, and generated
  API types.
- **WP6/WP7:** new photo-event utilities, a route-photo-playback coordinator,
  PhotoGallery/PhotoLightbox, and routes/$routeId.tsx.
- **WP8:** route/photo settings UI plus map, elevation, mobile, and cleanup
  integration tests.

## Implementation Constraints

- Keep route normalization, stops, gaps, interpolation, and photo planning pure
  and independent of React and ArcGIS.
- Preprocessing must remain linear; animation frames must not scan the full
  track or photo list.
- Keep derived route/session state out of persisted Zustand state; persist user
  preferences only.
- Publish React-visible progress at a bounded cadence while keeping ArcGIS
  marker updates imperative.
- Use session identifiers so stale image loads or timers cannot resume a newer
  playback run.
- Keep timezone lookup behind a backend adapter. Evaluate dependency size,
  hosting memory, historical DST behavior, and Python compatibility in WP5.
- Regenerate API contracts; do not hand-maintain divergent response types.
- Use spec acceptance scenarios AS-01 through AS-14 as the cross-package
  verification matrix.

## Principal Risks

| Risk | Mitigation |
| --- | --- |
| Timed GeoJSON inflates API payloads | Split list/detail serializers in WP1 |
| Stop detection becomes quadratic | Linear utility plus a large synthetic-track test |
| Time progress desynchronizes elevation | Separate distance progress per the route-data ADR |
| Pause reasons resume too early | Composable pause leases and state-machine tests |
| Stale async image work mutates a new session | Session IDs and cleanup guards |
| Timezone dependency is heavy or inaccurate | Backend adapter and explicit dependency evaluation |
| ArcGIS drops timing properties | Hosted geometry is never the playback source |
| Persisted settings select unsupported modes | Versioned migration and per-route fallback |

## Verification

Backend:

~~~bash
cd django_backend
pipenv run pytest
pipenv run ruff check .
~~~

Frontend:

~~~bash
cd frontend
pnpm typecheck
pnpm lint
pnpm test --run
pnpm build
~~~

Testing ownership:

- Backend tests cover GPX generation, API contracts, timezone normalization,
  access control, and list/detail serialization.
- Pure frontend tests cover track derivation, interpolation, stops, gaps,
  eligibility, grouping, and complexity.
- Engine/coordinator tests cover clocks, pause composition, event consumption,
  rebasing, stale callbacks, and cleanup.
- Manual verification covers ArcGIS rendering, actual image loading, responsive
  layout, keyboard/focus behavior, and visual elevation synchronization.

## Issue Handoff

Before implementation:

1. Review and accept the feature specification.
2. Confirm both ADRs remain accepted.
3. Create issues from WP1–WP8 with linked requirement IDs and acceptance
   scenarios.
4. Add issue URLs to the work-package table.

Implementation is complete when the specification's completion standard is met,
all linked issues are closed, and the verification commands pass.

