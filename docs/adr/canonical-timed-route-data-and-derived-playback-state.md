# ADR: Canonical Timed Route Data and Derived Playback State

**Date:** 2026-08-03  
**Status:** Accepted  
**Project:** map-routes-v2  
**Amends:** The GeoJSON decision in
[Hosting Platform and GeoJSON Storage Strategy](../plans/adr-hosting-and-geojson-storage.md)

## Context

The existing route pipeline parses GPX into GeoJSON coordinates, saves the
first point timestamp as `activity_date`, derives total `duration` from the
first and last points, and discards every intermediate point timestamp. It also
flattens GPX track segments into one line.

Route geometry is stored in `Route.geojson` and hosted as an ArcGIS Online item.
The existing animation does not use the local GeoJSON; it refetches the ArcGIS
copy, resamples its coordinates, and advances by point index or cumulative
distance.

Exact timestamp playback and timed photo events require more than geometry:

- Every animated coordinate must retain its recorded GPX timestamp.
- GPX segment boundaries must remain observable so playback does not invent a
  path across a recording gap.
- Playback must support original activity time, activity time with detected
  stops removed, and cumulative distance.
- Recorded-time progress is not generally equal to spatial-distance progress.
- Stop definitions and playback settings are expected to be tunable without
  rewriting stored route records.

This creates an architectural boundary question: which route information is
canonical and persisted, and which playback information is derived?

## Decision

Persist recorded route observations as canonical data. Derive playback
interpretations from those observations in frontend memory.

### 1. Canonical route observations live in timed GeoJSON

`Route.geojson` is the authoritative input for route playback. For newly parsed
GPX routes it contains:

- One GeoJSON `LineString` feature per GPX track segment.
- Each segment's ordered coordinates and elevations.
- One absolute, timezone-aware timestamp aligned with every coordinate.
- No invented geometry between separate track segments.

The expected timing property is an aligned `coordinate_times` array on each
feature. Timing remains feature metadata, so the stored document remains valid
GeoJSON and route coordinates retain their standard meaning.

The canonical representation must contain enough recorded information to
rebuild every supported playback timeline. Original GPX files do not need to be
retained after this representation has been produced.

### 2. ArcGIS is a rendering host, not a playback-data source

ArcGIS Online continues to host route geometry for the current map renderer,
and `arcgis_item_id` remains its hosting reference. The ArcGIS copy may contain
geometry only.

Animation, stop detection, timed photos, and other route-domain behavior must
consume canonical `Route.geojson`. They must not depend on ArcGIS preserving
arbitrary timestamp properties or on an ArcGIS-specific data model.

This amends the earlier hosting ADR: local GeoJSON is no longer merely a
cache/backup for playback-capable routes. It is the canonical route observation
record. ArcGIS remains the operational map-rendering host.

### 3. Playback timelines are derived projections

The frontend derives and memoizes a normalized timed-track model from canonical
GeoJSON. Derived values include:

- Original elapsed time.
- Cumulative route distance within segments.
- Detected stop intervals and stable stop anchors.
- Moving elapsed time with stops and skipped gaps collapsed.
- Unknown recording-gap metadata.
- Timestamp-to-position and distance-to-position lookup structures.
- Photo eligibility, event positions, and event groups.

These projections are not persisted in database fields. They are disposable
and must be rebuilt when canonical route data or relevant playback settings
change.

Stop detection initially uses code-level constants. Changing those constants
must change the derived result without requiring a data migration or rewriting
stored routes.

### 4. Timeline progress and spatial progress are separate concepts

The animation exposes distinct state:

- **Playback progress:** progress through the selected recorded-time or
  constant-distance playback timeline. This drives playback controls.
- **Distance progress:** progress through cumulative route distance at the
  marker's current position. This drives spatial consumers such as the
  elevation-profile cursor.
- **Track cursor:** the current segment, position, timestamp, elapsed times, and
  cumulative distance needed for photo scheduling and live setting changes.

No consumer may assume that a single normalized progress value represents both
activity time and route distance.

## Invariants

- Canonical route observations are provider-independent.
- Every derived timeline can be recreated from canonical route data and current
  settings.
- Derived stop or playback state cannot become stale in the database.
- Distance never includes a fictional connection across an unknown segment
  gap.
- A map-hosting provider can be replaced without changing route-domain logic.
- The elevation cursor follows marker distance even when time and distance
  progress diverge.

## Alternatives Considered

### Persist stop intervals and moving time on `Route`

Rejected. Stop detection is a heuristic whose constants will be tuned. Stored
results would become stale, require versioning and migrations, and duplicate
information derivable from the recorded track.

### Precompute every playback timeline on the backend

Rejected for the first implementation. Playback mode, stop skipping, target
duration, and photo grouping are interactive viewer settings. Returning every
possible projection would expand the API and still require frontend scheduling
logic.

Backend preprocessing may be reconsidered if measured browser performance
requires it, but it must remain a projection of canonical observations rather
than a replacement source of truth.

### Treat the ArcGIS item as the canonical timed track

Rejected. It would couple route-domain behavior to a rendering provider,
assume the provider preserves non-spatial properties, and weaken the existing
portability goal.

### Continue using one normalized animation progress value

Rejected. In recorded-time playback, equal increments of time can cover very
different distances or no distance at all. Reusing time progress for the
elevation cursor would visibly desynchronize spatial views.

### Store timestamps as additional coordinate elements

Rejected. Extra position elements have no portable GeoJSON time semantics and
would conflate spatial coordinates with feature metadata. An aligned feature
property is explicit and easier to validate.

## Consequences

### Positive

- Exact timestamp playback can be implemented without retaining raw GPX files.
- Stop detection and playback behavior can evolve without database migrations.
- Route animation no longer needs a second ArcGIS fetch for data already
  present on the route detail response.
- Timestamp, distance, elevation, and photo behavior can share one normalized
  track-domain model.
- Map rendering remains replaceable without rewriting playback logic.
- Each progress consumer receives the semantic value it actually needs.

### Costs and risks

- Timed GeoJSON is larger than geometry-only GeoJSON.
- Route list APIs must avoid returning full timed geometry when list views do
  not consume it.
- Frontend preprocessing becomes more sophisticated and needs strong pure-unit
  test coverage.
- Long routes require linear preprocessing, memoization, and logarithmic or
  monotonic per-frame lookup to avoid browser regressions.
- All consumers that currently assume one `LineString` or one progress value
  must be audited.
- The local GeoJSON role described by the older hosting ADR changes from
  cache/backup to authoritative playback input.

## Implementation Constraints

- Timed-track normalization and stop detection must be `O(n)` in point count.
- Per-frame work must not scan the entire route or photo list.
- Canonical timing metadata must be validated before enabling recorded-time
  features.
- Route detail responses provide canonical geometry; collection/list responses
  should use a lightweight representation.
- ArcGIS-hosted geometry and canonical database GeoJSON must describe the same
  recorded spatial segments, even when timing properties are omitted from the
  hosted copy.

## Related Requirements

- `RAP-DATA-001` through `RAP-DATA-009`
- `RAP-DATA-017` through `RAP-DATA-019`
- `RAP-TIME-001` through `RAP-TIME-012`
- `RAP-STOP-001` through `RAP-STOP-005`
- `RAP-PERF-001` through `RAP-PERF-008`

See
[Timestamped Route Animation Photos — Feature Specification](../specs/timestamped-route-animation-photos.md).
