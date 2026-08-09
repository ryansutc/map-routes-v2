"""Tests for trustworthy EXIF photo timestamp resolution."""

# ruff: noqa: D102

from datetime import UTC, datetime
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.routes.photo_timestamps import extract_taken_at, timezone_for_photo
from apps.routes.timezone_adapter import timezone_name_at

DATE_TIME_ORIGINAL = 36867
OFFSET_TIME_ORIGINAL = 36881


class PhotoTimestampTests(SimpleTestCase):
    """Exercise offsets, location fallback, historical zones, and unsafe times."""

    def test_embedded_offset_is_honored_without_a_location(self):
        taken_at = extract_taken_at(
            {
                DATE_TIME_ORIGINAL: "2024:07:01 12:30:00",
                OFFSET_TIME_ORIGINAL: "+02:30",
            },
            None,
        )

        self.assertEqual(taken_at, datetime(2024, 7, 1, 10, 0, tzinfo=UTC))

    def test_inline_offset_is_honored(self):
        taken_at = extract_taken_at(
            {DATE_TIME_ORIGINAL: "2024:07:01 12:30:00-07:00"},
            "America/Toronto",
        )

        self.assertEqual(taken_at, datetime(2024, 7, 1, 19, 30, tzinfo=UTC))

    def test_location_zone_applies_historical_summer_and_winter_offsets(self):
        summer = extract_taken_at(
            {DATE_TIME_ORIGINAL: "2024:07:01 12:00:00"}, "America/Vancouver"
        )
        winter = extract_taken_at(
            {DATE_TIME_ORIGINAL: "2024:01:01 12:00:00"}, "America/Vancouver"
        )

        self.assertEqual(summer, datetime(2024, 7, 1, 19, 0, tzinfo=UTC))
        self.assertEqual(winter, datetime(2024, 1, 1, 20, 0, tzinfo=UTC))

    def test_ambiguous_or_nonexistent_local_time_is_not_guessed(self):
        ambiguous = extract_taken_at(
            {DATE_TIME_ORIGINAL: "2024:11:03 01:30:00"}, "America/Vancouver"
        )
        nonexistent = extract_taken_at(
            {DATE_TIME_ORIGINAL: "2024:03:10 02:30:00"}, "America/Vancouver"
        )

        self.assertIsNone(ambiguous)
        self.assertIsNone(nonexistent)

    def test_unresolved_local_time_remains_unset(self):
        self.assertIsNone(extract_taken_at({DATE_TIME_ORIGINAL: "2024:01:01 12:00:00"}, None))

    def test_coordinate_lookup_uses_offline_iana_data(self):
        self.assertEqual(timezone_name_at(49.28, -123.12), "America/Vancouver")

    @patch("apps.routes.photo_timestamps.timezone_name_at")
    def test_photo_coordinate_is_preferred_over_route_start(self, lookup_mock):
        lookup_mock.return_value = "America/Vancouver"

        zone = timezone_for_photo(
            49.28,
            -123.12,
            _route_geojson([-79.38, 43.65, 100]),
        )

        self.assertEqual(zone, "America/Vancouver")
        lookup_mock.assert_called_once_with(49.28, -123.12)

    @patch("apps.routes.photo_timestamps.timezone_name_at")
    def test_route_start_is_used_when_photo_has_no_gps(self, lookup_mock):
        lookup_mock.return_value = "America/Toronto"

        zone = timezone_for_photo(None, None, _route_geojson([-79.38, 43.65, 100]))

        self.assertEqual(zone, "America/Toronto")
        lookup_mock.assert_called_once_with(43.65, -79.38)


def _route_geojson(coordinate: list[float]) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [coordinate]},
                "properties": {},
            }
        ],
    }
