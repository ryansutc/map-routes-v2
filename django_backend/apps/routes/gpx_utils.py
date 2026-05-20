"""Utilities for parsing GPX files into GeoJSON and activity metadata."""

import gpxpy


def parse_gpx(file_bytes: bytes) -> dict:
    """Parse a GPX file and return activity metadata and a GeoJSON FeatureCollection."""
    try:
        gpx = gpxpy.parse(file_bytes)
    except gpxpy.gpx.GPXException as exc:
        raise ValueError(f"Invalid GPX file: {exc}") from exc

    if not gpx.tracks:
        raise ValueError("GPX file contains no tracks")

    track = gpx.tracks[0]
    if not track.segments or not track.segments[0].points:
        raise ValueError("GPX track has no points")

    all_points = [pt for seg in track.segments for pt in seg.points]
    first_point = all_points[0]
    last_point = all_points[-1]

    date = first_point.time

    distance_m = track.length_3d() or track.length_2d()

    if first_point.time and last_point.time:
        duration_s = (last_point.time - first_point.time).total_seconds()
    else:
        duration_s = 0

    uphill, _ = track.get_uphill_downhill()
    elevation_gain_m = uphill or 0.0

    if distance_m and duration_s:
        avg_pace_decimal = (duration_s / 60) / (distance_m / 1000)
    else:
        avg_pace_decimal = 0.0

    coordinates = [
        [pt.longitude, pt.latitude, pt.elevation if pt.elevation is not None else 0.0]
        for pt in all_points
    ]
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {},
            }
        ],
    }

    return {
        "date": date.isoformat() if date else None,
        "distance_m": round(distance_m, 2) if distance_m else 0.0,
        "duration_s": int(duration_s),
        "avg_pace_decimal": round(avg_pace_decimal, 2),
        "elevation_gain_m": round(elevation_gain_m, 2),
        "geojson": geojson,
    }
