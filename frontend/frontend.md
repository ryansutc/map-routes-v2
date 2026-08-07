### Frontend Stack

- **Router**: TanStack Router (v1) with file-based routing in `src/routes/`
- **State**: Zustand for global state (`src/state/store.ts`)
- **Data Fetching**: TanStack Query with Zodios API client (code-generated from OpenAPI schema)
- **UI**: Material-UI (v7)
- **Mapping**: ArcGIS (`@arcgis/core`)
- **Validation**: Zod

Generated types from OpenAPI schema are in `src/generatedtypes/` (run `pnpm run schema` to regenerate).

## Development

prefer `pnpm` over `npm` commands.

## UI

Use material ui library. Follow standards in MUI.md

## Portability

The app's frontend map data is currently built on ESRI/ArcGIS (map rendering via `@arcgis/core`, geospatial data stored as GeoJSON items on ArcGIS Online). The architecture should remain portable so that, if needed, the map layer can be swapped to Leaflet or Mapbox and geodata migrated out of ArcGIS Online without rewriting the whole app. Concretely:

- Route geometry is stored as **standard GeoJSON** before uploading to ArcGIS. The canonical data is GeoJSON; ArcGIS Online is just the current host.
- Map components should be thin wrappers over the map library, not deeply coupled to ESRI APIs throughout the codebase.
- The `arcgis_item_id` on a Route is a hosting reference, not the source of truth.
