# backend

- **Framework**: Django 5.0+, Django REST Framework
- **Auth**: JWT tokens (SimpleJWT), social auth (django-social-auth)
- **Serialization**: DRF with camelCase conversion (djangorestframework-camel-case)
- **API Docs**: drf-spectacular (OpenAPI schema at `/api/schema/`)
- **Database**: SQLite (development; `app.db` in django_backend/)

## Commands

```bash
cd django_backend
pipenv shell  # to activate pipenv virtual environment
pipenv install # to install packages or add a package
# install a dev dependency
pipenv install --dev ruff

python manage.py migrate
python manage.py runserver     # http://localhost:8000
```

## Testing:

```
pipenv run pytest tests/
```
