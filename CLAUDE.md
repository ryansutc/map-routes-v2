# CLAUDE.md

**map-routes** is a full-stack app for sharing map routes. The frontend is a React + TypeScript SPA built with Vite, and the backend is a Django REST Framework API.

## Goal

- A simple app for sharing map routes
- this is a demonstration app only. We don't expect this app to be a fully running scaled production site. We want it secure and live but it doesn't need to have everything.
- We want it to run free (or near free). Design decisions are to favor this, such as storing files on free storage, keeping the database small, and not requiring too heavy processing power.

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

## Portability

The app is currently built on ESRI/ArcGIS (map rendering via `@arcgis/core`, geospatial data stored as GeoJSON items on ArcGIS Online). The architecture should remain portable so that, if needed, the map layer can be swapped to Leaflet or Mapbox and geodata migrated out of ArcGIS Online without rewriting the whole app. Concretely:

- Route geometry is stored as **standard GeoJSON** before uploading to ArcGIS. The canonical data is GeoJSON; ArcGIS Online is just the current host.
- Map components should be thin wrappers over the map library, not deeply coupled to ESRI APIs throughout the codebase.
- The `arcgis_item_id` on a Route is a hosting reference, not the source of truth.

## Debugging

VSCode launch configs (`.vscode/launch.json`)
