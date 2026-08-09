# Timestamped Route Animation Photos — Implementation Plan

**Status:** Issue-backed; ready for implementation

**Tracking issue:**
[#41 — Timestamped route animation photos](https://github.com/ryansutc/map-routes-v2/issues/41)

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

## Implementation Issues

The original eight work packages mapped closely to the implementation, but the
published issue graph uses narrower vertical slices where a package contained
independently reviewable behavior:

- WP1 became issues #42 and #43 so the canonical timed-route contract does not
  gate the independent route-list payload improvement.
- WP7 became issues #49 and #50 so automatic grouping/loading resilience can
  land before manual lightbox coordination.
- WP8 became issues #51 and #52 so eligibility explanations can land before the
  final cross-interface hardening pass.

The remaining work packages map one-to-one to issues. The issue graph is now the
implementation sequence; the former WP names below preserve the design history
only.

| Issue | Vertical slice | Former WP | Blocked by | Primary traceability |
| --- | --- | --- | --- | --- |
| [#42](https://github.com/ryansutc/map-routes-v2/issues/42) | Preserve canonical timed routes from GPX upload through route detail | WP1 | None | RAP-DATA-001–017/019, RAP-COMPAT-001–003 |
| [#43](https://github.com/ryansutc/map-routes-v2/issues/43) | Keep route collection responses lightweight | WP1 | None | RAP-DATA-017–019, RAP-PERF-007 |
| [#44](https://github.com/ryansutc/map-routes-v2/issues/44) | Build the TimedTrack domain model | WP2 | #42 | RAP-TIME-001–009, RAP-STOP-001–005, RAP-GAP-001–006, RAP-PERF-001–004/008 |
| [#45](https://github.com/ryansutc/map-routes-v2/issues/45) | Play timestamp-capable routes in recorded time | WP3 | #44 | RAP-TIME-010–012, RAP-MODE-001–013, RAP-STATE-001–010, RAP-COMPAT-004–006 |
| [#46](https://github.com/ryansutc/map-routes-v2/issues/46) | Support stop-aware playback and live setting changes | WP4 | #45 | RAP-STOP-006–012, RAP-MODE-014–022 |
| [#47](https://github.com/ryansutc/map-routes-v2/issues/47) | Store and correct trustworthy photo timestamps | WP5 | None | RAP-PHOTO-001–013 |
| [#48](https://github.com/ryansutc/map-routes-v2/issues/48) | Display one eligible timed photo during playback | WP6 | #46, #47 | RAP-EVENT-001–010, RAP-DISPLAY-001–003/007–009 |
| [#49](https://github.com/ryansutc/map-routes-v2/issues/49) | Group timed photos and tolerate image failures | WP7 | #48 | RAP-EVENT-011–016, RAP-DISPLAY-004–007, RAP-PERF-005–006 |
| [#50](https://github.com/ryansutc/map-routes-v2/issues/50) | Coordinate manual lightbox interaction with playback | WP7 | #49 | RAP-STATE-011–019 and cleanup aspects of RAP-STATE-003–010 |
| [#51](https://github.com/ryansutc/map-routes-v2/issues/51) | Explain timed-photo eligibility to owners and viewers | WP8 | #48 | RAP-MODE-016–017, RAP-UI-006–009 |
| [#52](https://github.com/ryansutc/map-routes-v2/issues/52) | Harden timed-photo playback across supported interfaces | WP8 | #43, #46, #49, #50, #51 | RAP-UI-001–005/010 and remaining performance/compatibility verification |

### Execution order

GitHub's native blocking relationships are the live source of truth. Work the
frontier: select an open, unassigned sub-issue whose blockers are all closed.
The initial frontier is #42, #43, and #47.

The main feature path is:

~~~text
#42 --> #44 --> #45 --> #46 --> #48 --> #49 --> #50
                              ^            |
#47 --------------------------+            +--> #52
                                   #48 --> #51 --> #52
#43 ---------------------------------------------> #52
~~~

#52 is the final integration issue. In addition to its transitive dependencies,
it is directly blocked by #43, #46, #49, #50, and #51 so the GitHub frontier
does not expose final hardening before every required integration surface is
ready.

### Primary files by implementation issue

- **#42:** GPX parsing, route creation/detail serialization, ArcGIS upload,
  route API tests, and generated frontend schema artifacts.
- **#43:** Route list/detail serializers, list consumers, API tests, and
  generated frontend schema artifacts.
- **#44:** New frontend timed-track utilities/tests and elevation-profile data
  derivation.
- **#45/#46:** Route animation hooks and utilities, controllers and controls,
  animation settings, elevation synchronization, and the Zustand store.
- **#47:** Backend photo extraction/views/serializers/tests, the owner photo
  editor, timezone lookup adapter, and generated API types.
- **#48/#49:** Photo-event utilities, the route-photo playback coordinator,
  automatic lightbox behavior, and the route detail screen.
- **#50:** Lightbox session ownership, manual gallery interaction, animation
  stop/resume coordination, and lifecycle cleanup tests.
- **#51:** Route animation settings and owner-facing photo eligibility UI.
- **#52:** Map, elevation, desktop/mobile, accessibility, performance, and
  cleanup integration coverage.

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
  hosting memory, historical DST behavior, and Python compatibility in #47.
- Regenerate API contracts; do not hand-maintain divergent response types.
- Use spec acceptance scenarios AS-01 through AS-14 as the cross-issue
  verification matrix.

## Principal Risks

| Risk | Mitigation |
| --- | --- |
| Timed GeoJSON inflates API payloads | Split list/detail serializers in #43 |
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

## Working the Plan

1. Use #41 only to track completion of the feature; implementation happens in
   its sub-issues.
2. Choose a frontier issue using its native GitHub blockers. Do not start a
   blocked issue merely because its prerequisite code appears nearly complete.
3. Treat the issue acceptance criteria as the review boundary and use the linked
   requirement IDs and acceptance scenarios for behavioral detail.
4. Preserve the architecture and implementation constraints in this plan while
   keeping each issue independently testable and reviewable.
5. Run the verification appropriate to the issue before closing it. Record any
   browser/map checks that cannot be automated.
6. After an issue closes, re-evaluate the GitHub frontier and take the next open,
   unassigned issue whose blockers have cleared.

Implementation is complete when the specification's completion standard is met,
issues #42–#52 are closed, #52's final verification passes, and the tracking
issue #41 can be closed.
