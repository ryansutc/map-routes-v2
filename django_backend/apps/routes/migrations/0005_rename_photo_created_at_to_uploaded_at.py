from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("routes", "0004_add_photo_taken_at"),
    ]

    operations = [
        migrations.RenameField(
            model_name="photo",
            old_name="created_at",
            new_name="uploaded_at",
        ),
    ]
