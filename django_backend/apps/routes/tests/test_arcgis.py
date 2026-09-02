"""Tests for ArcGIS hosted-item operations."""

from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from apps.routes.arcgis import delete_arcgis_item


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
