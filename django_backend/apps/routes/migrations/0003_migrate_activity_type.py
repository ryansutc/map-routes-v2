"""Data migration to normalise existing activity_type values to ActivityType choices."""

from django.db import migrations

ACTIVITY_MAP = {
    "hiking": "Hiking",
    "running": "Running",
    "cycling": "Cycling",
    "biking": "Cycling",
    "backpacking": "Backpacking",
    "skiing": "Skiing",
    "ski": "Skiing",
}


def normalise_activity_types(apps, schema_editor):
    """Map existing free-text activity_type values to the nearest enum value."""
    Route = apps.get_model("routes", "Route")
    for route in Route.objects.exclude(activity_type__isnull=True):
        normalised = ACTIVITY_MAP.get(route.activity_type.lower().strip(), "Other")
        route.activity_type = normalised
        route.save(update_fields=["activity_type"])


def reverse_normalise(apps, schema_editor):
    """No-op reverse: values are already stored as strings."""
    pass


class Migration(migrations.Migration):
    """Data migration to normalise activity_type to ActivityType choices."""

    dependencies = [
        ("routes", "0002_add_route_fields"),
    ]

    operations = [
        migrations.RunPython(normalise_activity_types, reverse_normalise),
    ]
