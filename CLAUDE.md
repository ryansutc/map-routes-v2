# CLAUDE.md

**map-routes** is a full-stack app for sharing map routes. The frontend is a React + TypeScript SPA built with Vite, and the backend is a Django REST Framework API.

## Architecture

### Frontend Stack

- see [frontend.md](/frontend/frontend.md)

### Backend Stack

- see [backend.md](/django_backend/backend.md)

Regenerate types whenever backend API changes (models, serializers, views).

### API Client

- Using Zodios (OpenAPI + Zod) for type-safe client
- Client instance in `src/api/` (axiosInstance, axiosClient)
- Queries/mutations use TanStack Query (react-query)


## Debugging

VSCode launch configs (`.vscode/launch.json`):

- **"Python Debugger: Django"** — Debugs backend (port 8000, breakpoints in views/models)
- **"Launch Chrome"** — Debugs frontend (attaches to Chrome at http://localhost:5173)

