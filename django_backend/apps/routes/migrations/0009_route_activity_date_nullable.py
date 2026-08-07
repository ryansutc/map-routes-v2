"""Allow legacy GPX routes without any trustworthy timestamp."""

from django.db import migrations, models


class Migration(migrations.Migration):
    """Make activity_date optional for timestamp-less GPX uploads."""

    dependencies = [("routes", "0008_normalize_optional_text_fields")]

    operations = [
        migrations.AlterField(
            model_name="route",
            name="activity_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
