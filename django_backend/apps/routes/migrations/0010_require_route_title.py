"""Normalize route titles and make the field required."""

from django.db import migrations, models


def replace_empty_route_titles(apps, schema_editor):
    """Give legacy empty and whitespace-only route titles a stable value."""
    Route = apps.get_model("routes", "Route")
    routes_to_update = []
    for route in Route.objects.only("id", "title").iterator():
        if not route.title.strip():
            route.title = "Untitled route"
            routes_to_update.append(route)
    if routes_to_update:
        Route.objects.bulk_update(routes_to_update, ["title"])


class Migration(migrations.Migration):
    """Normalize existing data before requiring route titles."""

    dependencies = [
        ("routes", "0009_route_activity_date_nullable"),
    ]

    operations = [
        migrations.RunPython(replace_empty_route_titles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="route",
            name="title",
            field=models.CharField(max_length=255),
        ),
    ]
