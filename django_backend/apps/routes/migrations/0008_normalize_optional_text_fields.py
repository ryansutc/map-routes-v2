"""Normalize legacy null text values and enforce current field constraints."""

from django.db import migrations, models


def replace_null_text_with_empty_strings(apps, schema_editor):
    """Normalize legacy nulls before SQLite rebuilds tables with NOT NULL fields."""
    Route = apps.get_model("routes", "Route")
    Photo = apps.get_model("routes", "Photo")
    for field in ("title", "activity_type", "arcgis_item_id", "notes", "route_link"):
        Route.objects.filter(**{f"{field}__isnull": True}).update(**{field: ""})
    Photo.objects.filter(title__isnull=True).update(title="")
    Photo.objects.filter(cloudinary_public_id__isnull=True).update(cloudinary_public_id="")


class Migration(migrations.Migration):
    """Normalize stored values before applying NOT NULL constraints."""

    dependencies = [
        ("routes", "0007_photo_cloudinary_public_id"),
    ]

    operations = [
        migrations.RunPython(replace_null_text_with_empty_strings, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="photo",
            name="title",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="route",
            name="activity_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Hiking", "Hiking"),
                    ("Running", "Running"),
                    ("Cycling", "Cycling"),
                    ("Backpacking", "Backpacking"),
                    ("Skiing", "Skiing"),
                    ("Other", "Other"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="route",
            name="arcgis_item_id",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AlterField(
            model_name="route",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="route",
            name="route_link",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name="route",
            name="title",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
