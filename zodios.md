# Django → Zodios Type Generation Pipeline

A custom way to generate type-safe frontend usage of an API automatically. See 

## Full Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        DJANGO BACKEND                           │
│                                                                 │
│  DRF Serializers  ──►  drf-spectacular  ──►  /api/schema/       │
│  (models.py,           (AutoSchema)          (OpenAPI 3.0 YAML) │
│   serializers.py)                                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │  (download/curl)
                                ▼
                    frontend/docs/schema.json
                    (OpenAPI 3.0 spec in JSON)
```

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND PIPELINE                         │
│                                                                 │
│   schema.json                                                   │
│       │                                                         │
│       │  [1] pnpm run schema-to-zod                             │
│       │      openapi-zod-client                                 │
│       ▼                                                         │
│   django_generated.ts  ◄────── Zod schemas + Zodios endpoints  │
│   (src/generatedtypes/)        (makeApi, z.object, etc.)        │
│       │                                                         │
│       │  [2] pnpm run schema-zod-to-json                        │
│       │      generate-schema-types.ts (tsx)                     │
│       ▼                                                         │
│   docs/schema_json.json  ◄──── zodToJsonSchema                 │
│                                                                 │
│       │  [3] pnpm run schema-json-to-ts                         │
│       │      json2ts                                            │
│       ▼                                                         │
│   src/types/django_api_types.ts  ◄── plain TypeScript types     │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                     RUNTIME USAGE                               │
│                                                                 │
│   django_generated.ts                                           │
│       └── endpoints  ──►  Zodios(BACKEND_DOMAIN, endpoints)     │
│                               (axiosClient.ts)                  │
│                               │                                 │
│                               ▼                                 │
│                           zodiosAPI  ──►  React hooks           │
│                                          (useRoute, useRoutes)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-step commands

**Step 1** — Export the OpenAPI schema from the running Django server:

```bash
# With Django running on port 8000:
curl http://localhost:8000/api/schema/ > frontend/docs/schema.json
```

**Step 2** — Run fetch + Zod generation from `frontend/`:

```bash
pnpm run schema
```

Which executes in sequence:

| Sub-command     | Tool                 | Input → Output                                                |
| --------------- | -------------------- | ------------------------------------------------------------- |
| `schema-fetch`  | `curl`               | `http://localhost:8000/api/schema/` → `docs/schema.json`      |
| `schema-to-zod` | `openapi-zod-client` | `docs/schema.json` → `src/generatedtypes/django_generated.ts` |

The following steps are available separately and can be run individually if needed:

| Sub-command          | Tool                           | Input → Output                                          |
| -------------------- | ------------------------------ | ------------------------------------------------------- |
| `schema-zod-to-json` | `tsx generate-schema-types.ts` | `django_generated.ts` → `docs/schema_json.json`         |
| `schema-json-to-ts`  | `json2ts`                      | `docs/schema.json` → `src/types/django_api_types.ts`    |
