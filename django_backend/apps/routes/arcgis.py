import requests

_SHARING_REST = "https://www.arcgis.com/sharing/rest"


def get_token(username: str, password: str) -> str:
    resp = requests.post(
        f"{_SHARING_REST}/generateToken",
        data={
            "username": username,
            "password": password,
            "referer": "https://www.arcgis.com",
            "expiration": 60,
            "f": "json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if "token" not in data:
        raise RuntimeError(f"ArcGIS token error: {data.get('error', data)}")
    return data["token"]


def upload_geojson(token: str, username: str, geojson_str: str, title: str) -> str:
    resp = requests.post(
        f"{_SHARING_REST}/content/users/{username}/addItem",
        data={
            "title": title,
            "type": "GeoJSON",
            "tags": "map-routes",
            "text": geojson_str,
            "f": "json",
            "token": token,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"ArcGIS addItem error: {data.get('error', data)}")
    return data["id"]


def share_item_public(token: str, username: str, item_id: str) -> None:
    resp = requests.post(
        f"{_SHARING_REST}/content/users/{username}/shareItems",
        data={
            "items": item_id,
            "everyone": "true",
            "f": "json",
            "token": token,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("notSharedWith"):
        raise RuntimeError(f"ArcGIS shareItems failed for item {item_id}")
