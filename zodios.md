# Django → Zodios Type Generation Pipeline

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
│                    (pnpm run schema)                            │
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
│   src/types/aspnet_api_types.ts  ◄── plain TypeScript types     │
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

**Step 2** — Run all three generation steps from `frontend/`:

```bash
pnpm run schema
```

Which executes in sequence:

| Sub-command          | Tool                           | Input → Output                                                |
| -------------------- | ------------------------------ | ------------------------------------------------------------- |
| `schema-to-zod`      | `openapi-zod-client`           | `docs/schema.json` → `src/generatedtypes/django_generated.ts` |
| `schema-zod-to-json` | `tsx generate-schema-types.ts` | `django_generated.ts` → `docs/schema_json.json`               |
| `schema-json-to-ts`  | `json2ts`                      | `docs/schema.json` → `src/types/aspnet_api_types.ts`          |

> **Note:** The `schema-zod-to-json` and `schema-json-to-ts` steps currently reference the old `aspnet_generated.ts` file — those may need updating to point to `django_generated.ts` if you want them to reflect the Django schema.
