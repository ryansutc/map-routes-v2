"""View for uploading photos to a route."""

from datetime import datetime
from typing import Any

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.shared_utils.error_utils import print_debug_error

from .cloudinary_utils import upload_photo
from .models import Photo, Route

MAX_PHOTOS_PER_ROUTE = 20


def _extract_taken_at(exif_data: dict) -> datetime | None:
    """Return the datetime a photo was taken from EXIF, or None if absent."""
    for tag_id, value in exif_data.items():
        tag = TAGS.get(tag_id, tag_id)
        if tag in ("DateTimeOriginal", "DateTime"):
            try:
                return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
            except (ValueError, TypeError):
                return None
    return None


def _extract_gps(exif_data: dict) -> tuple[float | None, float | None]:
    """Return (latitude, longitude) from EXIF data, or (None, None) if absent."""
    gps_info: dict[str, Any] = {}
    for tag_id, value in exif_data.items():
        tag = TAGS.get(tag_id, tag_id)
        if tag == "GPSInfo":
            for gps_tag_id, gps_value in value.items():
                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                gps_info[gps_tag] = gps_value

    if not gps_info:
        return None, None

    try:
        lat = _dms_to_decimal(gps_info["GPSLatitude"], gps_info.get("GPSLatitudeRef", "N"))
        lng = _dms_to_decimal(gps_info["GPSLongitude"], gps_info.get("GPSLongitudeRef", "E"))
        return lat, lng
    except (KeyError, TypeError, ZeroDivisionError):
        return None, None


def _dms_to_decimal(dms: tuple, ref: str) -> float:
    """Convert degrees/minutes/seconds tuple to decimal degrees."""
    degrees, minutes, seconds = dms
    decimal = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


class RoutePhotoView(APIView):
    """Upload a photo to a route, extracting EXIF GPS and storing via Cloudinary."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request, pk: int) -> Response:
        """Accept an image file, extract GPS EXIF, upload to Cloudinary, save Photo record."""
        try:
            route = Route.objects.get(pk=pk)
        except Route.DoesNotExist:
            return Response({"detail": "Route not found."}, status=404)

        if route.owner != request.user.email:
            return Response({"detail": "You do not own this route."}, status=403)

        if route.photos.count() >= MAX_PHOTOS_PER_ROUTE:
            return Response(
                {"detail": f"Route already has the maximum of {MAX_PHOTOS_PER_ROUTE} photos."},
                status=400,
            )

        if "file" not in request.FILES:
            return Response({"detail": "No file provided."}, status=400)

        uploaded_file = request.FILES["file"]
        file_bytes = uploaded_file.read()

        try:
            image = Image.open(uploaded_file)
            exif_data = image._getexif() or {}
            lat, lng = _extract_gps(exif_data)
            lat = round(lat, 6) if lat is not None else None
            lng = round(lng, 6) if lng is not None else None
            taken_at = _extract_taken_at(exif_data)
        except Exception:
            lat, lng, taken_at = None, None, None

        try:
            secure_url = upload_photo(file_bytes, uploaded_file.name)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=502)
        except Exception:
            print_debug_error()
            return Response({"detail": "Photo upload to Cloudinary failed."}, status=502)

        title = request.data.get("title") or None

        photo = Photo.objects.create(
            route=route,
            url=secure_url,
            latitude=lat,
            longitude=lng,
            taken_at=taken_at,
            title=title,
        )

        return Response(
            {
                "id": photo.id,
                "url": photo.url,
                "title": photo.title,
                "latitude": photo.latitude,
                "longitude": photo.longitude,
                "taken_at": photo.taken_at,
                "has_gps": lat is not None and lng is not None,
            },
            status=201,
        )
