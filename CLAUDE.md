# CLAUDE.md

**map-routes** is a full-stack app for sharing map routes. The frontend is a React + TypeScript SPA built with Vite, and the backend is a Django REST Framework API.

## Architecture

### Frontend Stack

- **Router**: TanStack Router (v1) with file-based routing in `src/routes/`
- **State**: Zustand for global state (`src/state/store.ts`)
- **Data Fetching**: TanStack Query with Zodios API client (code-generated from OpenAPI schema)
- **UI**: Material-UI (v7)
- **Mapping**: ArcGIS (`@arcgis/core`)
- **Validation**: Zod

Generated types from OpenAPI schema are in `src/generatedtypes/` (run `pnpm run schema` to regenerate).

### Backend Stack

- **Framework**: Django 5.0+, Django REST Framework
- **Auth**: JWT tokens (SimpleJWT), social auth (django-social-auth)
- **Serialization**: DRF with camelCase conversion (djangorestframework-camel-case)
- **API Docs**: drf-spectacular (OpenAPI schema at `/api/schema/`)
- **Database**: SQLite (development; `app.db` in django_backend/)

## Development

prefer `pnpm` over `npm` commands.

**Backend**

```bash
cd django_backend
python -m venv .venv  # or use existing .venv at repo root
source .venv/bin/activate
pip install -r requirements.txt  # or use pipenv: pipenv install
python manage.py migrate
python manage.py runserver     # http://localhost:8000
```

Tests:

```
pipenv run pytest tests/
```

Regenerate types whenever backend API changes (models, serializers, views).

### API Client

- Using Zodios (OpenAPI + Zod) for type-safe client
- Client instance in `src/api/` (axiosInstance, axiosClient)
- Queries/mutations use TanStack Query (react-query)

## Key Files

- **Frontend entry**: `src/main.tsx` → `src/App.tsx`
- **Root route layout**: `src/routes/__root.tsx`
- **Map route**: `src/routes/map.$routeId.tsx` (dynamic route by ID)
- **Auth routes**: `src/routes/auth/` (login, logout, callback)
- **Backend settings**: `django_backend/django_backend/settings.py`
- **URL routing**: `django_backend/apps/*/urls.py`

## Debugging

VSCode launch configs (`.vscode/launch.json`):

- **"Python Debugger: Django"** — Debugs backend (port 8000, breakpoints in views/models)
- **"Launch Chrome"** — Debugs frontend (attaches to Chrome at http://localhost:5173)

## Linting & Type Checking

- **Frontend ESLint**: `pnpm lint` (flat config in `eslint.config.js`; complexity warnings at 30, no-console warnings except warn/error)
- **Frontend TypeScript**: `pnpm typecheck` (strict `tsconfig.app.json`)
- **Backend**: No linter configured; consider adding if expanding

**Add a new API endpoint**

1. Create model and serializer in `django_backend/apps/routes/`
2. Add viewset in `views.py`, register in `urls.py`
3. Run `python manage.py migrate` (if schema changed)
4. Run `pnpm run schema` in frontend to regenerate types

**Add a new frontend route**

1. Create file in `src/routes/` following TanStack Router conventions (`/routes/my-page.tsx`)
2. Export route component with layout parent
3. Router is auto-generated in `src/routeTree.gen.ts`

```bash
pnpm run copy-esri-assets
```
