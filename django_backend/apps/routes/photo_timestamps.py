"""Resolve trustworthy, timezone-aware photo timestamps."""

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from PIL.ExifTags import TAGS

from .timezone_adapter import timezone_name_at

_EXIF_DATETIME_FIELDS = (
    ("DateTimeOriginal", "OffsetTimeOriginal"),
    ("DateTimeDigitized", "OffsetTimeDigitized"),
    ("DateTime", "OffsetTime"),
)


def timezone_for_photo(
    latitude: float | None,
    longitude: float | None,
    route_geojson: dict[str, Any] | None,
) -> str | None:
    """Resolve a photo's interpretation zone, preferring its own coordinate."""
    if latitude is not None and longitude is not None:
        return timezone_name_at(latitude, longitude)

    route_coordinate = _first_route_coordinate(route_geojson)
    if route_coordinate is None:
        return None
    return timezone_name_at(route_coordinate[1], route_coordinate[0])


def extract_taken_at(exif_data: dict[Any, Any], timezone_name: str | None) -> datetime | None:
    """Return an aware UTC EXIF timestamp, declining unsafe local-time guesses."""
    tagged_exif = {TAGS.get(tag_id, tag_id): value for tag_id, value in exif_data.items()}

    for datetime_field, offset_field in _EXIF_DATETIME_FIELDS:
        if datetime_field not in tagged_exif:
            continue

        raw_datetime = _as_text(tagged_exif[datetime_field])
        raw_offset = _as_text(tagged_exif.get(offset_field))
        if raw_datetime is None:
            return None

        naive_datetime, inline_offset = _parse_exif_datetime(raw_datetime)
        if naive_datetime is None:
            return None

        offset = raw_offset or inline_offset
        if offset is not None:
            aware_datetime = _apply_explicit_offset(naive_datetime, offset)
        else:
            aware_datetime = _localize_unambiguous_time(naive_datetime, timezone_name)
        return aware_datetime.astimezone(UTC) if aware_datetime is not None else None

    return None


def _as_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            return value.decode("ascii").strip().rstrip("\x00")
        except UnicodeDecodeError:
            return None
    return value.strip().rstrip("\x00") if isinstance(value, str) else None


def _parse_exif_datetime(value: str) -> tuple[datetime | None, str | None]:
    inline_offset = None
    if len(value) >= 6 and value[-6] in ("+", "-") and value[-3] == ":":
        inline_offset = value[-6:]
        value = value[:-6].rstrip()
    try:
        return datetime.strptime(value, "%Y:%m:%d %H:%M:%S"), inline_offset
    except ValueError:
        return None, inline_offset


def _apply_explicit_offset(value: datetime, offset: str) -> datetime | None:
    try:
        return datetime.strptime(
            f"{value:%Y:%m:%d %H:%M:%S} {offset}", "%Y:%m:%d %H:%M:%S %z"
        )
    except ValueError:
        return None


def _localize_unambiguous_time(value: datetime, timezone_name: str | None) -> datetime | None:
    if timezone_name is None:
        return None
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return None

    candidates: list[datetime] = []
    for fold in (0, 1):
        candidate = value.replace(tzinfo=zone, fold=fold)
        round_trip = candidate.astimezone(UTC).astimezone(zone).replace(tzinfo=None)
        if round_trip == value and all(
            existing.utcoffset() != candidate.utcoffset() for existing in candidates
        ):
            candidates.append(candidate)

    return candidates[0] if len(candidates) == 1 else None


def _first_route_coordinate(
    geojson: dict[str, Any] | None,
) -> tuple[float, float] | None:
    if not isinstance(geojson, dict):
        return None

    features = geojson.get("features") if geojson.get("type") == "FeatureCollection" else [geojson]
    if not isinstance(features, list):
        return None

    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") if feature.get("type") == "Feature" else feature
        if not isinstance(geometry, dict):
            continue
        coordinates = geometry.get("coordinates")
        if geometry.get("type") == "LineString":
            coordinate = coordinates[0] if isinstance(coordinates, list) and coordinates else None
        elif geometry.get("type") == "MultiLineString":
            coordinate = (
                coordinates[0][0]
                if isinstance(coordinates, list)
                and coordinates
                and isinstance(coordinates[0], list)
                and coordinates[0]
                else None
            )
        else:
            continue
        if (
            isinstance(coordinate, (list, tuple))
            and len(coordinate) >= 2
            and isinstance(coordinate[0], (int, float))
            and not isinstance(coordinate[0], bool)
            and isinstance(coordinate[1], (int, float))
            and not isinstance(coordinate[1], bool)
        ):
            return float(coordinate[0]), float(coordinate[1])
    return None
