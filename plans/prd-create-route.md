# PRD: Create New Route with Photo Upload

## Problem Statement

Users of map-routes have no way to create routes from within the app. Currently, routes and photos must be added directly to the database or via admin tooling. Users need a self-serve flow to publish a route they completed, attach geotagged photos from that activity, and share i.

## Solution

A two-step wizard that lets an authenticated user create a route by uploading a `.gpx` file, auto-deriving route metadata from that file, uploading geotagged photos that auto-place themselves on the map, and publishing the result.

**Step 1 — Route Metadata:**
The user selects or drag-and-drops a `.gpx` file exported from Garmin Connect, Strava, or any GPS device. The backend parses the file, converts geometry to GeoJSON, uploads the GeoJSON to ArcGIS Online (free account), and returns auto-derived metadata: date, distance, duration, avg pace, and elevation gain. The user then fills in title and activity type (dropdown), reviews/edits all fields, and proceeds.

**Step 2 — Photos & Notes:**
The user drag-and-drops up to 20 photos. Each photo is processed server-side: EXIF GPS coordinates are extracted, the file is uploaded to Cloudinary (free tier), and the returned URL is stored. As each upload completes, a pin appears on a live ArcGIS map showing the route. Photos without GPS EXIF are accepted and shown in the gallery but not pinned on the map (Phase 1). The user can add free-text notes, then publish the route.

## User Stories

1. As an authenticated user, I want to create a new route from the routes list page so that I can share my activity.
2. As an authenticated user, I want to upload a `.gpx` file so that my route geometry is automatically imported.
3. As an authenticated user, I want the app to auto-fill date, distance, duration, avg pace, and elevation gain from my GPX file so that I don't have to enter them manually.
4. As an authenticated user, I want to review and edit all auto-filled fields before publishing so that I can correct any GPS inaccuracies.
5. As an authenticated user, I want to select an activity type from a dropdown so that my route is correctly categorized.
6. As an authenticated user, I want to give my route a title so that others can identify it.
7. As an authenticated user, I want to add free-text notes to my route so that I can provide context about the activity.
8. As an authenticated user, I want to drag-and-drop multiple photos at once so that uploading is fast and convenient.
9. As an authenticated user, I want my photos to auto-place on the map based on their GPS metadata so that viewers can see where each photo was taken.
10. As an authenticated user, I want to see a live map preview in Step 2 with pins appearing as photos upload so that I can verify placement before publishing.
11. As an authenticated user, I want photos without GPS metadata to still be accepted and shown in the gallery so that I don't have to pre-filter my uploads.
12. As an authenticated user, I want my route to default to private so that I control when it becomes visible to others.
13. As an authenticated user, I want to toggle my route public/private during creation so that I don't have to edit it after publishing.
14. As an authenticated user, I want clear validation errors if the uploaded file is not a valid `.gpx` file so that I can correct it.
15. As an authenticated user, I want to see a progress indicator as my photos upload so that I know the app is working.
16. As an authenticated user, after publishing, I want to be taken directly to my new route's detail page so that I can see the final result.

## Implementation Decisions

### Schema Changes

New fields on the `Route` model:

| Field            | Type                     | Notes                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| `duration`       | `IntegerField`           | Total seconds, derived from GPX                            |
| `avg_pace`       | `DecimalField(6,2)`      | Stored as decimal minutes/km                               |
| `elevation_gain` | `DecimalField(8,2)`      | Stored in meters                                           |
| `activity_type`  | `CharField` with choices | Enum: Hiking, Running, Cycling, Backpacking, Skiing, Other |
| `arcgis_item_id` | `CharField(32, null=True)` | ArcGIS Online portal item ID for the route GeoJSON layer |
| `geojson`        | `JSONField(null=True)`   | Canonical GeoJSON of the route geometry; portability escape hatch if migrating away from ArcGIS |

All new fields are nullable to avoid breaking existing routes.

`activity_type` changes from free text to a locked choices field. Existing values should be migrated via a data migration.

### Units

- All values stored in **metric internally** (GPX is metric): meters, min/km
- Display units default to **metric** (km, m, min/km) but can be toggled to **imperial** (miles, feet, min/mile)
- Conversion happens at the frontend display layer only — storage and serialization are always metric
- Unit preference is global (not per-route): stored in **Zustand**, persisted to `localStorage` via `partialize`
- The toggle renders in the **nav header** (`AppShell`), visible to all users (authenticated and not)
- The wizard displays units matching the user's global preference; there is no per-wizard override
- The toggle applies everywhere route stats are displayed: wizard, route list, route detail

### Backend — New Endpoints

**`POST /api/routes/parse-gpx/`** (authenticated)

- Accepts: `multipart/form-data` with a `.gpx` file
- Parses the uploaded file using `gpxpy`
- Extracts: start datetime, total distance (m), duration (s), avg pace, elevation gain (m)
- Converts track geometry to GeoJSON
- Uploads GeoJSON to ArcGIS Online via the ArcGIS REST API, returns item ID
- Returns: `{ arcgis_item_id, date, distance_m, duration_s, avg_pace_decimal, elevation_gain_m }`
- Validates that the uploaded file is a valid GPX document; returns 400 on parse failure
- Does NOT create a Route record yet

**`POST /api/routes/`** (existing endpoint, extend write serializer)

- Add new fields to `RouteWriteSerializer`: `duration`, `avg_pace`, `elevation_gain`

**`POST /api/routes/{id}/photos/`** (new endpoint)

- Accepts: `multipart/form-data` with image file
- Reads EXIF GPS using `Pillow` + `piexif` or `exifread`
- Uploads file to Cloudinary via `cloudinary` Python SDK
- Creates `Photo` record with Cloudinary URL + extracted lat/lng
- Returns: `{ id, url, latitude, longitude, has_gps: bool }`
- Enforces max 20 photos per route

### Backend — Libraries

- `gpxpy` — GPX parsing
- `Pillow` — image EXIF reading
- `cloudinary` — Cloudinary Python SDK for photo upload
- ArcGIS Online REST API — GeoJSON item creation (via `requests`, using stored credentials)

### Frontend — New Pages & Components

**`/routes/new`** — new TanStack Router route (auth-guarded)

**`CreateRouteWizard`** — top-level wizard component managing step state

**Step 1: `RouteMetadataStep`**

- GPX file drop zone (or file picker) + "Parse" button
- Loading state while backend parses and uploads to ArcGIS
- Auto-populated fields: date, distance, duration, avg pace, elevation gain (all editable)
- Manual fields: title (required), activity type (required dropdown), is_public toggle
- Notes textarea
- "Next" button → proceeds to Step 2

**Step 2: `PhotoUploadStep`**

- ArcGIS map (reuse existing `MapContainer`) showing parsed route geometry
- `PhotoDropzone` — drag-and-drop area (react-dropzone), max 20 files, image types only
- Upload queue showing each photo's status (pending / uploading / placed / no GPS)
- As each upload completes: pin appears on map (reuse `PhotoController` pattern)
- Ungeotagged photos shown in tray with "No GPS" badge, not pinned
- Notes field (carries over from Step 1, editable)
- "Publish" button → `POST /api/routes/` then `POST /api/routes/{id}/photos/` for each photo → redirect to `/routes/{id}`

**Auth guard:** redirect to `/login?next=/routes/new` if `userIsAuthenticated` is false

### Activity Type Enum

```
Hiking | Running | Cycling | Backpacking | Skiing | Other
```

Stored as string values in DB. Frontend renders as MUI `Select`.

### API Client

- Add Zodios endpoint definitions for `parse-gpx` and `routes/{id}/photos/`
- Regenerate types after serializer changes

### Cloudinary Configuration

- Cloudinary credentials stored in Django settings via environment variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Photos uploaded to a `map-routes/photos/` folder in Cloudinary
- Returned `secure_url` stored in `Photo.url`

### ArcGIS Online Configuration

- ArcGIS credentials stored in Django settings via environment variables
- GeoJSON items created in the authenticated user's ArcGIS Online account (or a shared service account)
- Item shared publicly if route is public, private otherwise

## Out of Scope

- **Phase 2: Manual pin placement** — ungeotagged photos cannot be manually pinned on the map in this phase
- **Editing an existing route** — this PRD covers creation only; edit flow is a separate feature
- **Deleting a route** — separate feature
- **GPX URL input** — direct file upload is used instead; pasting a remote URL is not supported
- **Elevation profile chart** — storing and rendering a full elevation profile as a JSON array
- **Strava/Garmin OAuth integration** — user manually exports and provides a GPX URL
- **Photo reordering** — photos are ordered by upload sequence / timestamp
- **Video uploads**
- **Anonymous route creation**

## Further Notes

- **Cost constraint is a primary driver.** All storage uses free-tier services: ArcGIS Online (geometry), Cloudinary (photos). The Django backend stores only metadata + external URLs/IDs. No files are persisted on the server.
- **TrailReplay** (https://github.com/alexalmansa/TrailReplay) is the UX reference for the photo-on-map interaction. Consult it for the photo pin + gallery interaction patterns.
- The existing `dropboxImgHelpers.ts` utility will become obsolete for new photos but should be kept for backward compatibility with existing routes that use Dropbox URLs.
- ArcGIS Online item visibility (public/private) should mirror the route's `is_public` flag and be updated if the user later toggles visibility.
- The 20-photo cap should be enforced both on the frontend (disable dropzone after 20) and the backend (reject with 400 if exceeded).
