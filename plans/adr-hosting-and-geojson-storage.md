# ADR: Hosting Platform and GeoJSON Storage Strategy

**Date:** 2026-05-10  
**Status:** Accepted  
**Project:** map-routes-v2

## Context

map-routes is a demo app with a cost constraint: it must run free or near-free. The backend is Django with SQLite. We needed to decide:

1. Where to host the Django app
2. How to store route geometry (GeoJSON) relative to ArcGIS Online

## Decisions

### Hosting: PythonAnywhere

**Chosen over:** Render, Railway, Fly.io

PythonAnywhere is the best free fit for Django + SQLite:

- SQLite file persists on disk on the free tier (no paid disk add-on required)
- No cold-start spin-down (unlike Render free web services)
- Native Django support, no container complexity
- Custom domain available on paid tier ($5/mo) when needed
- 512MB storage on free tier — sufficient for demo scale

Render's free tier does not support persistent disk (SQLite would be wiped on redeploy). Railway and Fly.io no longer offer permanent free tiers for new accounts.

### GeoJSON Storage: Dual-field approach

**Route model fields:**

- `arcgis_item_id` — the ArcGIS Online portal item ID (32-char string). Used by the frontend `LayerController` to render the route via `GeoJSONLayer` with `portalItem.id`.
- `geojson` — `JSONField(null=True)`. Stores the canonical GeoJSON as a local cache/backup, populated at upload time.

**Why both:**

- `arcgis_item_id` is the operational reference — the frontend reads it directly.
- `geojson` is the portability escape hatch. ArcGIS Online is the current host, not the source of truth. If the app migrates to Leaflet/Mapbox, the GeoJSON is already in the DB — no re-fetch from ArcGIS required.
- Fixtures only need to populate `arcgis_item_id` (a short string), keeping fixture files small and readable. The `geojson` field is populated at runtime by the parse-gpx endpoint.

**DB size impact:** A GPX route as GeoJSON is typically 20–150KB. At 50 routes that's under 10MB — well within SQLite free tier limits on PythonAnywhere.

## Consequences

- Migration away from ArcGIS (to Leaflet + self-hosted tiles, Mapbox, etc.) requires only: re-uploading `geojson` values to the new host and swapping the map component. No data is stranded in ArcGIS.
- The `geojson` field may be null for routes created before this feature (existing routes use `arcgis_item_id` only). Code that reads `geojson` must handle null gracefully.