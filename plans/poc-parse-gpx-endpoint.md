# PoC Plan: POST /api/routes/parse-gpx/

## Goal

Prove the GPX → GeoJSON → ArcGIS Online pipeline works end-to-end by implementing the real `parse-gpx` endpoint. Testable via Postman. No UI, no DB writes.

## Endpoint

**`POST /api/route/parse-gpx/`** (authentication required)

### Request
`multipart/form-data` with a single field:
- `file` — a `.gpx` file

### Response (200)
```json
{
  "arcgis_item_id": "39afcd5d16df4ad190a6434cc0583724",
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "date": "2026-04-12T09:15:00Z",
  "distance_m": 32400.0,
  "duration_s": 7200,
  "avg_pace_decimal": 3.70,
  "elevation_gain_m": 420.5
}
```

### Error responses
- `400` — file is missing, not a valid GPX, or has no track data
- `502` — ArcGIS REST API call failed

## Implementation Steps

### 1. Dependencies
Add to `requirements.txt`:
- `gpxpy` — GPX parsing

`requests` is already available via Django/DRF.

### 2. Environment Variables
Add to `.env` (and `.env.example`):
```
ARCGIS_USERNAME=your_arcgis_username
ARCGIS_PASSWORD=your_arcgis_password
```

Add to `django_backend/settings.py`:
```python
ARCGIS_USERNAME = os.environ.get("ARCGIS_USERNAME")
ARCGIS_PASSWORD = os.environ.get("ARCGIS_PASSWORD")
```

### 3. ArcGIS REST helper (`apps/routes/arcgis.py`)

Three functions, all using `requests`:

**`get_token(username, password) -> str`**
- POST to `https://www.arcgis.com/sharing/rest/generateToken`
- Params: `username`, `password`, `referer=https://www.arcgis.com`, `expiration=60`, `f=json`
- Returns token string

**`upload_geojson(token, username, geojson_str, title) -> str`**
- POST to `https://www.arcgis.com/sharing/rest/content/users/{username}/addItem`
- Params: `title`, `type=GeoJSON`, `tags=map-routes`, `text={geojson_str}`, `f=json`, `token`
- Returns item ID string

**`share_item_public(token, username, item_id)`**
- POST to `https://www.arcgis.com/sharing/rest/content/users/{username}/shareItems`
- Params: `items={item_id}`, `everyone=true`, `f=json`, `token`

### 4. GPX parsing helper (`apps/routes/gpx_utils.py`)

**`parse_gpx(file_bytes) -> dict`**

Uses `gpxpy.parse()` on the file bytes. Extracts:
- `date` — `track.segments[0].points[0].time`
- `distance_m` — `track.length_3d()` (falls back to `length_2d()` if no elevation data)
- `duration_s` — `(last_point.time - first_point.time).total_seconds()`
- `elevation_gain_m` — `track.get_uphill_elevation()`
- `geojson` — `FeatureCollection` with one `LineString` feature built from `[[pt.longitude, pt.latitude] for pt in points]`

Returns `{ date, distance_m, duration_s, avg_pace_decimal, elevation_gain_m, geojson }`.

Raises `ValueError` with a descriptive message if the file has no tracks, no segments, or no points.

`avg_pace_decimal` = `(duration_s / 60) / (distance_m / 1000)` (min/km)

### 5. View (`apps/routes/views.py`)

New `ParseGpxView(APIView)`:
- Permission: `IsAuthenticated`
- Reads `request.FILES["file"]`
- Calls `parse_gpx()` → raises 400 on `ValueError`
- Calls `get_token()`, `upload_geojson()`, `share_item_public()` → raises 502 on failure
- Returns response with all fields including `geojson`

### 6. URL
Add to `apps/routes/urls.py`:
```python
path("parse-gpx/", ParseGpxView.as_view(), name="parse-gpx"),
```

## Testing with Postman

1. Authenticate: `POST /api/auth/token/` → get JWT
2. `POST /api/route/parse-gpx/`
   - Header: `Authorization: Bearer <token>`
   - Body: `form-data`, key=`file`, value=any `.gpx` file
3. Verify response contains `arcgis_item_id`
4. Verify item appears at `https://www.arcgis.com/home/item.html?id={arcgis_item_id}`
5. Verify item is publicly accessible (open in incognito)

## Architectural Notes

- No DB writes in this endpoint — Route creation is a separate step (`POST /api/routes/`)
- The `geojson` in the response is passed back by the frontend when publishing, then stored in the `Route.geojson` JSONField at that point
- Fresh ArcGIS token generated per request (token caching deferred)
- Each test run creates a new ArcGIS item — clean up via arcgis.com content portal filtering by tag `map-routes`
- `route_link` on the existing Route model is unchanged; new routes will use the new `arcgis_item_id` field (added in a later migration)

## Out of Scope for this PoC

- DB writes / Route record creation
- Model migrations (`arcgis_item_id`, `geojson`, `duration`, `avg_pace`, `elevation_gain` fields)
- Frontend wizard
- Photo upload
- Token caching
