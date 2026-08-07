"""Utilities for parsing GPX files into GeoJSON and activity metadata."""

from copy import deepcopy
from datetime import UTC, datetime

import gpxpy


def _aware_utc_timestamp(value: datetime | None) -> str | None:
    """Return an absolute ISO timestamp, or None when the GPX time is unusable."""
    if value is None or value.tzinfo is None or value.utcoffset() is None:
        return None
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_gpx(file_bytes: bytes) -> dict:
    """Parse a GPX file and return activity metadata and a GeoJSON FeatureCollection."""
    try:
        gpx = gpxpy.parse(file_bytes)
    except gpxpy.gpx.GPXException as exc:
        raise ValueError(f"Invalid GPX file: {exc}") from exc

    if not gpx.tracks:
        raise ValueError("GPX file contains no tracks")

    tracks = [track for track in gpx.tracks if any(segment.points for segment in track.segments)]
    segments = [segment for track in tracks for segment in track.segments if segment.points]
    if not segments:
        raise ValueError("GPX track has no points")

    all_points = [point for segment in segments for point in segment.points]
    valid_times = [
        point.time for point in all_points if _aware_utc_timestamp(point.time) is not None
    ]
    first_valid_time = valid_times[0] if valid_times else None
    last_valid_time = valid_times[-1] if valid_times else None

    distance_m = sum((track.length_3d() or track.length_2d() or 0.0) for track in tracks)

    if first_valid_time and last_valid_time:
        duration_s = max(0, (last_valid_time - first_valid_time).total_seconds())
    else:
        duration_s = 0

    elevation_gain_m = sum((track.get_uphill_downhill()[0] or 0.0) for track in tracks)

    if distance_m and duration_s:
        avg_pace_decimal = (duration_s / 60) / (distance_m / 1000)
    else:
        avg_pace_decimal = 0.0

    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [
                            point.longitude,
                            point.latitude,
                            point.elevation if point.elevation is not None else 0.0,
                        ]
                        for point in segment.points
                    ],
                },
                "properties": {
                    "coordinate_times": [
                        _aware_utc_timestamp(point.time) for point in segment.points
                    ]
                },
            }
            for segment in segments
        ],
    }

    return {
        "date": _aware_utc_timestamp(first_valid_time),
        "distance_m": round(distance_m, 2) if distance_m else 0.0,
        "duration_s": int(duration_s),
        "avg_pace_decimal": round(avg_pace_decimal, 2),
        "elevation_gain_m": round(elevation_gain_m, 2),
        "geojson": geojson,
    }


def geometry_only_geojson(canonical_geojson: dict) -> dict:
    """Return a provider-neutral rendering copy without canonical timing metadata."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": deepcopy(feature.get("geometry")),
                "properties": {},
            }
            for feature in canonical_geojson.get("features", [])
        ],
    }
