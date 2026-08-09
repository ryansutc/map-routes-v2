"""Tests for the routes application."""

import json
import textwrap
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.routes.gpx_utils import geometry_only_geojson, parse_gpx

GPX_WITH_ELEVATION = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk>
        <trkseg>
          <trkpt lat="47.0" lon="-122.0"><ele>100.0</ele><time>2024-01-01T00:00:00Z</time></trkpt>
          <trkpt lat="47.1" lon="-122.1"><ele>200.0</ele><time>2024-01-01T00:10:00Z</time></trkpt>
          <trkpt lat="47.2" lon="-122.2"><ele>150.0</ele><time>2024-01-01T00:20:00Z</time></trkpt>
        </trkseg>
      </trk>
    </gpx>
""").encode()

GPX_WITHOUT_ELEVATION = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk>
        <trkseg>
          <trkpt lat="47.0" lon="-122.0"><time>2024-01-01T00:00:00Z</time></trkpt>
          <trkpt lat="47.1" lon="-122.1"><time>2024-01-01T00:10:00Z</time></trkpt>
        </trkseg>
      </trk>
    </gpx>
""").encode()

MULTI_SEGMENT_GPX = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk>
        <trkseg>
          <trkpt lat="47.0" lon="-122.0"><ele>100</ele><time>2024-01-01T01:00:00+01:00</time></trkpt>
          <trkpt lat="47.1" lon="-122.1"><ele>110</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg>
        <trkseg>
          <trkpt lat="48.0" lon="-123.0"><ele>120</ele><time>2024-01-01T00:10:00Z</time></trkpt>
          <trkpt lat="48.1" lon="-123.1"><ele>130</ele><time>2024-01-01T00:15:00Z</time></trkpt>
        </trkseg>
      </trk>
      <trk>
        <trkseg>
          <trkpt lat="49.0" lon="-124.0"><ele>140</ele><time>2024-01-01T00:20:00Z</time></trkpt>
        </trkseg>
      </trk>
    </gpx>
""").encode()

GPX_WITH_INCOMPLETE_TIMES = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="47.0" lon="-122.0" />
        <trkpt lat="47.1" lon="-122.1"><time>not-a-time</time></trkpt>
        <trkpt lat="47.2" lon="-122.2"><time>2024-01-01T00:10:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>
""").encode()

GPX_WITH_BACKWARD_TIME = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="47.0" lon="-122.0"><time>2024-01-01T00:10:00Z</time></trkpt>
        <trkpt lat="47.1" lon="-122.1"><time>2024-01-01T00:05:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>
""").encode()

GPX_WITHOUT_TIMES = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="47.0" lon="-122.0" />
        <trkpt lat="47.1" lon="-122.1" />
      </trkseg></trk>
    </gpx>
""").encode()


def _coords(result):
    """Return coordinates from the first parsed feature."""
    return result["geojson"]["features"][0]["geometry"]["coordinates"]


def test_parse_gpx_includes_elevation_as_third_coordinate():
    """Preserve GPX elevation as the third GeoJSON coordinate element."""
    result = parse_gpx(GPX_WITH_ELEVATION)
    coords = _coords(result)
    assert len(coords) == 3
    assert coords[0] == [-122.0, 47.0, 100.0]
    assert coords[1] == [-122.1, 47.1, 200.0]
    assert coords[2] == [-122.2, 47.2, 150.0]


def test_parse_gpx_falls_back_to_zero_when_elevation_missing():
    """Keep every coordinate three-dimensional when GPX elevation is absent."""
    result = parse_gpx(GPX_WITHOUT_ELEVATION)
    coords = _coords(result)
    for coord in coords:
        assert len(coord) == 3
        assert coord[2] == 0.0


def test_parse_gpx_preserves_tracks_segments_and_aligned_absolute_times():
    """Build one feature and one absolute timestamp per recorded segment point."""
    result = parse_gpx(MULTI_SEGMENT_GPX)

    features = result["geojson"]["features"]
    assert len(features) == 3
    assert [feature["properties"]["coordinate_times"] for feature in features] == [
        ["2024-01-01T00:00:00Z", "2024-01-01T00:05:00Z"],
        ["2024-01-01T00:10:00Z", "2024-01-01T00:15:00Z"],
        ["2024-01-01T00:20:00Z"],
    ]
    assert all(
        len(feature["geometry"]["coordinates"]) == len(feature["properties"]["coordinate_times"])
        for feature in features
    )
    assert result["date"] == "2024-01-01T00:00:00Z"
    assert result["duration_s"] == 1200


def test_parse_gpx_retains_invalid_timing_as_legacy_compatible_geometry():
    """Do not synthesize missing or malformed timestamps or reject their geometry."""
    result = parse_gpx(GPX_WITH_INCOMPLETE_TIMES)

    feature = result["geojson"]["features"][0]
    assert len(feature["geometry"]["coordinates"]) == 3
    assert feature["properties"]["coordinate_times"] == [
        None,
        None,
        "2024-01-01T00:10:00Z",
    ]
    assert result["date"] == "2024-01-01T00:10:00Z"
    assert result["duration_s"] == 0


def test_parse_gpx_preserves_backward_times_for_strict_legacy_validation():
    """Keep source observations so playback can reject a backward timeline."""
    result = parse_gpx(GPX_WITH_BACKWARD_TIME)

    assert result["geojson"]["features"][0]["properties"]["coordinate_times"] == [
        "2024-01-01T00:10:00Z",
        "2024-01-01T00:05:00Z",
    ]
    assert result["duration_s"] == 0


def test_geometry_only_geojson_preserves_segment_geometry_without_times():
    """Remove canonical timing metadata from the rendering-provider copy."""
    canonical = parse_gpx(MULTI_SEGMENT_GPX)["geojson"]

    rendered = geometry_only_geojson(canonical)

    assert [feature["geometry"] for feature in rendered["features"]] == [
        feature["geometry"] for feature in canonical["features"]
    ]
    assert all(feature["properties"] == {} for feature in rendered["features"])
    assert all("coordinate_times" in feature["properties"] for feature in canonical["features"])


@override_settings(ARCGIS_USERNAME="test-user", ARCGIS_PASSWORD="test-password")
class TimedGpxApiTests(TestCase):
    """Exercise canonical route data from parsing through route detail."""

    def setUp(self):
        """Authenticate an owner for parse and route creation requests."""
        self.user = get_user_model().objects.create_user(
            username="owner@example.com", email="owner@example.com", password="test"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.routes.views.share_item_public")
    @patch("apps.routes.views.upload_geojson", return_value="arcgis-item")
    @patch("apps.routes.views.get_token", return_value="token")
    def test_parse_uploads_geometry_only_and_returns_canonical_data(
        self, _token_mock, upload_mock, _share_mock
    ):
        """Keep timing in the API response while excluding it from ArcGIS upload."""
        response = self.client.post(
            "/api/route/parse-gpx/",
            {"file": SimpleUploadedFile("timed.gpx", MULTI_SEGMENT_GPX)},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        canonical = response.data["geojson"]
        hosted = json.loads(upload_mock.call_args.args[2])
        self.assertEqual(
            [feature["geometry"] for feature in hosted["features"]],
            [feature["geometry"] for feature in canonical["features"]],
        )
        self.assertTrue(all(feature["properties"] == {} for feature in hosted["features"]))
        self.assertTrue(
            all("coordinate_times" in feature["properties"] for feature in canonical["features"])
        )

        create_response = self.client.post(
            "/api/route/",
            {
                "title": "Timed route",
                "activity_date": response.data["date"],
                "activity_type": "Hiking",
                "distance": response.data["distance_m"],
                "duration": response.data["duration_s"],
                "avg_pace": response.data["avg_pace_decimal"],
                "elevation_gain": response.data["elevation_gain_m"],
                "arcgis_item_id": response.data["arcgis_item_id"],
                "track_point_count": response.data["track_point_count"],
                "geojson": canonical,
                "is_public": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        detail_response = self.client.get(f"/api/route/{create_response.data['id']}/")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data["geojson"], canonical)

        self.client.force_authenticate(user=None)
        public_response = self.client.get(f"/api/route/{create_response.data['id']}/")
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(public_response.data["geojson"], canonical)

        self.client.force_authenticate(self.user)
        private_update = self.client.patch(
            f"/api/route/{create_response.data['id']}/", {"is_public": False}, format="json"
        )
        self.assertEqual(private_update.status_code, 200)
        other_user = get_user_model().objects.create_user(
            username="viewer@example.com", email="viewer@example.com", password="test"
        )
        self.client.force_authenticate(other_user)
        private_response = self.client.get(f"/api/route/{create_response.data['id']}/")
        self.assertEqual(private_response.status_code, 404)

    @patch("apps.routes.views.share_item_public")
    @patch("apps.routes.views.upload_geojson", return_value="legacy-item")
    @patch("apps.routes.views.get_token", return_value="token")
    def test_timestamp_less_gpx_can_create_a_legacy_route(
        self, _token_mock, _upload_mock, _share_mock
    ):
        """Allow otherwise valid geometry through creation without inventing a date."""
        parse_response = self.client.post(
            "/api/route/parse-gpx/",
            {"file": SimpleUploadedFile("legacy.gpx", GPX_WITHOUT_TIMES)},
            format="multipart",
        )
        self.assertEqual(parse_response.status_code, 200)
        self.assertIsNone(parse_response.data["date"])

        create_response = self.client.post(
            "/api/route/",
            {
                "title": "Legacy route",
                "activity_date": None,
                "activity_type": "Hiking",
                "distance": parse_response.data["distance_m"],
                "duration": parse_response.data["duration_s"],
                "arcgis_item_id": parse_response.data["arcgis_item_id"],
                "track_point_count": parse_response.data["track_point_count"],
                "geojson": parse_response.data["geojson"],
                "is_public": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertIsNone(create_response.data["activity_date"])
