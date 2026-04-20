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