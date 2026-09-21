"""Tests for ArcGIS hosted-item operations."""

from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from apps.routes.arcgis import delete_arcgis_item, get_folder_id, upload_geojson


@patch("apps.routes.arcgis.requests.get")
def test_get_folder_id_finds_folder_by_exact_title(get_mock):
    """Resolve a configured folder name to the ID required by addItem."""
    response = MagicMock()
    response.json.return_value = {
        "folders": [
            {"id": "development-id", "title": "development"},
            {"id": "production-id", "title": "production"},
        ]
    }
    get_mock.return_value = response

    folder_id = get_folder_id("arcgis-token", "route-owner", "production")

    assert folder_id == "production-id"
    get_mock.assert_called_once_with(
        "https://www.arcgis.com/sharing/rest/content/users/route-owner",
        params={"f": "json", "token": "arcgis-token"},
        timeout=15,
    )
    response.raise_for_status.assert_called_once_with()


@patch("apps.routes.arcgis.requests.get")
def test_get_folder_id_rejects_unknown_folder(get_mock):
    """Do not silently put production content in the root folder on a typo."""
    response = MagicMock()
    response.json.return_value = {"folders": []}
    get_mock.return_value = response

    with pytest.raises(RuntimeError, match="ArcGIS folder not found: production"):
        get_folder_id("arcgis-token", "route-owner", "production")


@patch("apps.routes.arcgis.get_folder_id", return_value="production-id")
@patch("apps.routes.arcgis.requests.post")
def test_upload_geojson_adds_item_to_configured_folder(post_mock, get_folder_id_mock):
    """Put an upload under the ArcGIS folder ID resolved from configuration."""
    response = MagicMock()
    response.json.return_value = {"success": True, "id": "item-123"}
    post_mock.return_value = response

    item_id = upload_geojson(
        "arcgis-token",
        "route-owner",
        '{"type":"FeatureCollection","features":[]}',
        "Morning ride",
        folder_name="production",
    )

    assert item_id == "item-123"
    get_folder_id_mock.assert_called_once_with("arcgis-token", "route-owner", "production")
    post_mock.assert_called_once_with(
        "https://www.arcgis.com/sharing/rest/content/users/route-owner/production-id/addItem",
        data={
            "title": "Morning ride",
            "type": "GeoJson",
            "tags": "map-routes",
            "f": "json",
            "token": "arcgis-token",
        },
        files={
            "file": (
                "Morning ride.geojson",
                b'{"type":"FeatureCollection","features":[]}',
                "application/geo+json",
            )
        },
        timeout=30,
    )


@override_settings(ARCGIS_USERNAME="route-owner", ARCGIS_PASSWORD="secret")
@patch("apps.routes.arcgis.requests.post")
@patch("apps.routes.arcgis.get_token", return_value="arcgis-token")
def test_delete_arcgis_item_sends_the_provider_request(_get_token_mock, post_mock):
    """Send the configured owner's item ID to ArcGIS and accept a successful result."""
    response = MagicMock()
    response.json.return_value = {"results": [{"itemId": "item-123", "success": True}]}
    post_mock.return_value = response

    delete_arcgis_item("item-123")

    post_mock.assert_called_once_with(
        "https://www.arcgis.com/sharing/rest/content/users/route-owner/deleteItems",
        data={"items": "item-123", "f": "json", "token": "arcgis-token"},
        timeout=15,
    )
    response.raise_for_status.assert_called_once_with()


@override_settings(ARCGIS_USERNAME="route-owner", ARCGIS_PASSWORD="secret")
@patch("apps.routes.arcgis.requests.post")
@patch("apps.routes.arcgis.get_token", return_value="arcgis-token")
def test_delete_arcgis_item_rejects_an_unsuccessful_provider_result(_get_token_mock, post_mock):
    """Treat an ArcGIS-level failure as cleanup failure even when HTTP succeeds."""
    response = MagicMock()
    response.json.return_value = {"results": [{"itemId": "item-123", "success": False}]}
    post_mock.return_value = response

    with pytest.raises(RuntimeError, match="item-123"):
        delete_arcgis_item("item-123")
