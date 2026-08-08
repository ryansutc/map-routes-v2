"""Offline coordinate-to-timezone lookup adapter."""

from functools import lru_cache

from timezonefinder import TimezoneFinder

_timezone_finder = TimezoneFinder(in_memory=False)


@lru_cache(maxsize=4096)
def timezone_name_at(latitude: float, longitude: float) -> str | None:
    """Return the IANA timezone containing a valid coordinate, if one exists."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return _timezone_finder.timezone_at(lat=latitude, lng=longitude)
