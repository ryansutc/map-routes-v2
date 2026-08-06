# ADR: Strict Legacy Fallback for Timestamped Playback

**Date:** 2026-08-03  
**Status:** Accepted  
**Project:** map-routes-v2

## Context

Exact recorded-time route playback and timed photo scheduling require a valid
timestamp for every animated GPX point. Existing routes retain only geometry,
route start time, and total duration because their intermediate timestamps were
discarded. Some newly uploaded GPX files may also contain missing, malformed,
or backward timestamps.

It is technically possible to approximate a route clock by mapping:

```text
(photo taken_at - route activity_date) / route duration
```

onto point-index or distance progress. That approximation cannot reproduce
variable pace, actual stopped time, recorder pauses, or the route position at a
specific timestamp. It can place a photo at a convincing but unsupported
location.

The application therefore needs an explicit compatibility policy for routes
that do not satisfy the timed-track contract.

## Decision

Use a strict capability boundary. Never present approximate photo scheduling as
recorded-time behavior.

### 1. Timestamp capability is all-or-nothing

A route is timestamp-capable only when:

- Every animated coordinate has a valid timestamp.
- Timestamp and coordinate arrays align one-to-one.
- Timestamps are globally nondecreasing in playback order, including across
  segment boundaries.

Equal timestamps are valid and represent instantaneous movement. Any missing,
malformed, or backward timestamp classifies the entire route as legacy for
playback purposes.

Capability is derived from canonical route data rather than stored as a manual
flag.

### 2. Legacy routes retain useful existing behavior

Legacy routes continue to support their existing GPS-point/index and
constant-speed animation modes. Their maps, elevation profiles, and manually
opened photo galleries continue to work.

A GPX upload with invalid or incomplete timing data is still accepted when its
geometry is otherwise valid. It becomes a legacy route rather than failing the
entire route creation flow.

### 3. Timestamp-dependent features are unavailable on legacy routes

Legacy routes do not support:

- Recorded-time playback.
- Stop detection based on recorded elapsed time.
- Skip-detected-stops playback.
- Automatic photo scheduling.
- Approximate photo scheduling based on normalized duration, point index,
  distance fraction, or photo GPS.

Photos on legacy routes remain ordinary gallery content.

The UI must explain that recorded point timestamps are unavailable. It must not
silently hide a failed approximation behind the same controls used by exact
routes.

### 4. No inferred migration or backfill

The system does not attempt to reconstruct discarded point timestamps from
geometry, total duration, average pace, photo times, or photo locations.

An existing legacy route can gain exact capability only from a future workflow
that supplies and validates the original timed track again. Such a workflow is
outside the current feature and would require its own specification and
decision record.

## Invariants

- `Recorded time` always means playback backed by recorded GPX point timestamps.
- An automatically scheduled photo always has a defensible timestamp-derived
  route position.
- A legacy route never changes behavior merely because it has `activity_date`,
  `duration`, or photos with `taken_at`.
- Invalid timing data cannot partially enable exact behavior on only some route
  segments.
- Legacy classification does not make route geometry or manual photos unusable.

## Alternatives Considered

### Proportional activity-time fallback

Map a photo's offset from route start onto normalized route duration and then
onto point-index or distance progress.

Rejected. It appears precise while losing stops and pace variation. The marker
may be far from the recorded location at the photo time, especially on long
stops, loops, or activities with strongly varying speed.

### Spatial fallback using photo GPS

Place an event where the route passes closest to the photo coordinate.

Rejected. A route may pass the same location more than once, photo GPS may be
missing or imprecise, and spatial proximity does not establish when the photo
belongs in playback.

### Partial timed playback

Enable recorded-time features only on segments or regions that contain valid
timestamps.

Rejected. This would create mixed timing semantics inside one session, make
mode availability difficult to explain, and introduce edge cases when photos
fall near invalid regions. The first implementation uses a predictable
route-level capability boundary.

### Reject route upload when timing is incomplete

Rejected. Geometry-only routes remain useful and already have supported
animation modes. Timestamped photos are an enhancement, not a prerequisite for
route creation.

### Disable all animation for legacy routes

Rejected. Existing animation does not claim to reproduce exact activity time
and should remain available for compatibility.

## Consequences

### Positive

- The meaning of recorded-time playback remains trustworthy.
- Photo events never appear at a fabricated timestamp-derived location.
- Capability checks and user messaging are deterministic.
- Existing routes preserve their current map, animation, elevation, and gallery
  behavior.
- Tests can enforce a clear boundary instead of validating degrees of
  approximation.

### Costs and risks

- Existing routes do not receive automatic photo playback.
- A single invalid point timestamp downgrades an otherwise timed route to
  legacy behavior.
- Owners need the original timed GPX data to upgrade a legacy route in any
  future workflow.
- Playback controls and settings must be route-capability-aware.
- Documentation and eligibility UI must explain why some routes lack the new
  feature.

## Implementation Constraints

- Capability validation must be deterministic and shared by every frontend
  consumer that enables timestamp-dependent behavior.
- Unsupported persisted settings must fall back to a mode supported by the
  current route.
- Photo eligibility diagnostics must identify legacy-route exclusion separately
  from missing or out-of-range photo time.
- Tests must cover existing timestamp-less routes and newly parsed routes with
  missing, malformed, equal, and backward timestamps.
- No migration may populate synthetic point timestamps while this ADR remains
  accepted.

## Reconsideration Triggers

Revisit this decision only if one of the following becomes available:

- Original timed GPX files can be securely reattached to legacy routes.
- A product requirement explicitly accepts approximate playback with visibly
  distinct labeling and behavior.
- A future timed-track format can prove exact equivalence from other retained
  source observations.

Any change that enables approximate automatic photo timing requires a new ADR
and an update to the feature specification.

## Related Requirements

- `RAP-DATA-010` through `RAP-DATA-016`
- `RAP-MODE-005` through `RAP-MODE-008`
- `RAP-EVENT-001` through `RAP-EVENT-007`
- `RAP-COMPAT-001` through `RAP-COMPAT-004`

See
[Timestamped Route Animation Photos — Feature Specification](../specs/timestamped-route-animation-photos.md).
