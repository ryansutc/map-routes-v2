from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("routes", "0006_add_track_point_count"),
    ]

    operations = [
        migrations.AddField(
            model_name="photo",
            name="cloudinary_public_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
