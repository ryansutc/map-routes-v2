# backend

- **Framework**: Django 5.0+, Django REST Framework
- **Auth**: JWT tokens (SimpleJWT), social auth (django-social-auth)
- **Serialization**: DRF with camelCase conversion (djangorestframework-camel-case)
- **API Docs**: drf-spectacular (OpenAPI schema at `/api/schema/`)
- **Database**: SQLite (development; `app.db` in django_backend/)

## Commands

```bash
cd django_backend
python -m venv .venv  # or use existing .venv at repo root
source .venv/bin/activate
pip install -r requirements.txt  # or use pipenv: pipenv install
python manage.py migrate
python manage.py runserver     # http://localhost:8000
```

## Testing:

```
pipenv run pytest tests/
```
