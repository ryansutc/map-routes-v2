"""Tests for the routes application."""

import textwrap

import pytest

from apps.routes.gpx_utils import parse_gpx


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


def _coords(result):
    return result["geojson"]["features"][0]["geometry"]["coordinates"]


def test_parse_gpx_includes_elevation_as_third_coordinate():
    result = parse_gpx(GPX_WITH_ELEVATION)
    coords = _coords(result)
    assert len(coords) == 3
    assert coords[0] == [-122.0, 47.0, 100.0]
    assert coords[1] == [-122.1, 47.1, 200.0]
    assert coords[2] == [-122.2, 47.2, 150.0]


def test_parse_gpx_falls_back_to_zero_when_elevation_missing():
    result = parse_gpx(GPX_WITHOUT_ELEVATION)
    coords = _coords(result)
    for coord in coords:
        assert len(coord) == 3
        assert coord[2] == 0.0
