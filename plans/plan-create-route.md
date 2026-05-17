# Implementation Plan: Create New Route with Photo Upload

> Source PRD: `plans/prd-create-route.md`

## Phase Overview

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | PoC: `POST /api/route/parse-gpx/` — GPX → GeoJSON → ArcGIS Online | ✅ Done (see `plans/poc-parse-gpx-endpoint.md`) |
| 1 | Backend foundations — DB migrations, Route write serializer, photo endpoint |  |
| 2 | Frontend Step 1 — GPX upload wizard (route metadata) |  |
| 3 | Frontend Step 2 — Photo upload with live map pins |  |
| 4 | Polish & hardening — validation, error states, imperial/metric toggle |  |

---

## Phase 1 — Backend Foundations

### Goals
- Extend the `Route` model with new fields
- Extend `RouteWriteSerializer` to accept those fields
- Add `POST /api/routes/{id}/photos/` endpoint (Cloudinary upload + EXIF extraction)
- Add Cloudinary credentials to settings / env

### Tasks

#### 1.1 Model migration
Add nullable fields to `Route`:

| Field | Type |
|-------|------|
| `duration` | `IntegerField(null=True, blank=True)` |
| `avg_pace` | `DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)` |
| `elevation_gain` | `DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)` |
| `activity_type` | `CharField(max_length=20, choices=ActivityType, null=True, blank=True)` |
| `arcgis_item_id` | `CharField(max_length=32, null=True, blank=True)` |
| `geojson` | `JSONField(null=True, blank=True)` |

Define `ActivityType` as a `TextChoices` enum: `HIKING`, `RUNNING`, `CYCLING`, `BACKPACKING`, `SKIING`, `OTHER`.

Write a data migration to map any existing free-text `activity_type` values to the closest enum value (default `OTHER` for unrecognised).

#### 1.2 Serializers
- Add all new fields to `RouteWriteSerializer` (all optional to avoid breaking existing clients)
- Add all new fields to `RouteReadSerializer` / `RouteSerializer` so frontend can display them
- Regenerate TypeScript types (`npm run generate-types` or equivalent)

#### 1.3 Cloudinary setup
- Add to `requirements.txt`: `cloudinary`, `Pillow`
- Add env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Add to `django_backend/settings.py` and `.env.example`
- Create `apps/routes/cloudinary_utils.py` with `upload_photo(file_bytes, filename) -> str` that returns `secure_url`

#### 1.4 Photo endpoint
New file `apps/routes/photo_views.py` (or add to `views.py`):

**`POST /api/routes/{id}/photos/`** — `RoutePhotoView(APIView)`
- Permission: `IsAuthenticated`; must own the route
- Reject if route already has 20 photos (return 400)
- Accept optional `title` string in request body (multipart form field); stored on the Photo record, `null` if omitted
- Read EXIF GPS with Pillow (`_getexif()` / `piexif`) → nullable `latitude`, `longitude`
- Upload file to Cloudinary → `secure_url`
- Create `Photo(route=route, url=secure_url, latitude=lat, longitude=lng, title=title)`
- Return `{ id, url, title, latitude, longitude, has_gps: bool }`

Add URL: `path("<int:pk>/photos/", RoutePhotoView.as_view(), name="route-photos")`

#### 1.5 API client
- Add Zodios endpoint definitions for the new photo endpoint
- Update any auto-generated type files

### Deliverable
Backend fully tested via Postman: create a route with new fields, upload a photo, confirm Cloudinary URL returned and GPS extracted.

---

## Phase 2 — Frontend Step 1: Route Metadata Wizard

### Goals
- New auth-guarded route `/routes/new`
- `CreateRouteWizard` shell managing step state
- `RouteMetadataStep` component: GPX drop → parse → editable form → "Next"

### Tasks

#### 2.1 Router setup
- Add `/routes/new` to TanStack Router config
- Auth guard: redirect to `/login?next=/routes/new` if unauthenticated

#### 2.2 `CreateRouteWizard`
- Manages `step: 1 | 2` and shared form state (`WizardState`)
- `WizardState` holds: parsed metadata, title, activityType, isPublic, notes, arcgisItemId, geojson

#### 2.3 `RouteMetadataStep`
- GPX drop zone (react-dropzone, `.gpx` only) + "Parse" button
- Calls `POST /api/route/parse-gpx/` (mutation via TanStack Query)
- Loading spinner while parsing
- On success: populate editable fields:
  - Date (read-only from GPX)
  - Distance (read-only from GPX, displayed in km)
  - Duration (editable)
  - Avg pace (editable)
  - Elevation gain (editable)
  - Title (required text input)
  - Activity type (MUI `Select` with `ActivityType` options)
  - Is public toggle
  - Notes (textarea)
- "Next" button enabled only when title + activityType filled and GPX parsed
- Validation: show field-level errors for required fields on submit attempt

#### 2.4 API client additions
- Zodios mutation for `parse-gpx` (already exists from Phase 0 — verify/add if missing)
- Type `ParseGpxResponse` used across wizard state

### Deliverable
User can navigate to `/routes/new`, upload a GPX, see auto-filled form, edit fields, and click Next (Step 2 stub is fine).

---

## Phase 3 — Frontend Step 2: Photo Upload & Publish

### Goals
- `PhotoUploadStep`: map + drag-and-drop photo uploader with live pin placement
- Publish flow: `POST /api/routes/` → `POST /api/routes/{id}/photos/` for each photo → redirect

### Tasks

#### 3.1 `PhotoUploadStep` layout
- Left panel: `PhotoDropzone` (react-dropzone, image types only, max 20)
- Right panel: ArcGIS map (reuse `MapContainer`) displaying parsed route geometry from wizard state
- Upload queue list below dropzone showing each file's status: `pending | uploading | placed | no-gps | error`

#### 3.2 Upload queue logic
- On file drop: add files to queue with status `pending`
- Sequentially (or with limited concurrency) call `POST /api/routes/{id}/photos/` for each
  - Note: route must be created first (see 3.3)
- On success: update status to `placed` or `no-gps`; add pin to map if `has_gps: true`
- On error: update status to `error`, show retry option

#### 3.3 Publish flow
1. "Publish" button calls `POST /api/routes/` with all wizard state fields (title, activityType, isPublic, notes, duration, avg_pace, elevation_gain, arcgis_item_id, geojson, distance, date)
2. On route creation success: begin uploading queued photos to `POST /api/routes/{id}/photos/`
3. Once all uploads done (or user skips): redirect to `/routes/{id}`

#### 3.4 Map integration
- Parse `geojson` from wizard state → render as a `GraphicsLayer` LineString on the map
- Photo pins: reuse or adapt existing `PhotoController` / pin rendering pattern
- Ungeotagged photos shown in a tray/gallery with "No GPS" badge, not pinned

#### 3.5 "Add route" entry point
- Add a "Create Route" / "+ New Route" button on the routes list page linking to `/routes/new`

### Deliverable
Full wizard working end-to-end: upload GPX → edit metadata → upload photos → publish → see route detail page with map and photo pins.

---

## Phase 4 — Polish & Hardening

### Goals
- Imperial/metric display toggle
- Edge case handling and error UX
- 20-photo cap enforced frontend + backend (Phase 1 backend, here on frontend)
- ArcGIS item visibility mirrors `is_public`

### Tasks

#### 4.1 Unit display toggle
- Add a `useUnits` context/hook (`metric | imperial`)
- Convert display values at render time only (store always in metric)
- Persist preference in `localStorage`
- Render toggle control in wizard header or app settings

#### 4.2 ArcGIS visibility sync
- When `is_public` is set at publish time, call `share_item_public` (already exists) or keep private
- If user later toggles `is_public` on an existing route (separate edit flow, out of scope here — note for future)

#### 4.3 Error handling
- Parse GPX failure (400) → inline error below dropzone, allow re-upload
- ArcGIS upload failure (502) → toast with retry option; do not advance to Step 2
- Photo upload failure → per-file error state in queue with retry
- Route creation failure → toast, stay on Step 2, do not redirect

#### 4.4 Validation
- Frontend: disable "Parse" if no file selected; disable "Next" if required fields missing
- Backend: confirm 400 returned for non-GPX file, missing file, and >20 photos (integration tests)

#### 4.5 Backward compatibility
- Keep `dropboxImgHelpers.ts` intact for existing routes using Dropbox URLs
- Ensure `RouteReadSerializer` returns `null` for new nullable fields on old routes (no frontend breakage)

### Deliverable
Wizard is robust: handles all error paths, displays units correctly, and existing routes are unaffected.

---

## Cross-Cutting Notes

- **Cost constraint**: no files persisted on the Django server — only metadata + external URLs/IDs
- **Portability**: canonical data is GeoJSON in `Route.geojson`; ArcGIS is just the host
- **Photo cap**: 20 photos max, enforced in both backend (Phase 1) and frontend (Phase 3)
- **Token caching** (ArcGIS): deferred — fresh token per request for now
- **Cleanup**: ArcGIS test items accumulate; filter by tag `map-routes` on arcgis.com content portal
