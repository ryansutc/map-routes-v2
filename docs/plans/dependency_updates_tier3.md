# Tier 3 Dependency Upgrades — Plan

TL;DR: Tiers 1 and 2 are merged on `chore/frontend-dep-upgrades` and cleared the
routine and low-risk-major upgrades. What remains are six pieces of work that each
touch a large surface area or are outright blocked, so they are deliberately kept
out of that PR. Each item below should be its own branch and PR. They are ordered
by effort, not by priority — pick off the cheap ones first to keep the audit count
falling while the expensive ones are scheduled.

## Current state

As of 2026-07-26, after Tier 1 and Tier 2:

- `pnpm audit`: **71 findings** — 1 critical, 32 high, 33 moderate, 5 low
  (down from 95 / 2 critical / 50 high at the start).
- Only **two** remaining findings touch code shipped to users: `lodash-es` via
  `@arcgis/core` (high + moderate). Everything else is dev tooling or codegen.
- The single remaining **critical** is `handlebars` via `openapi-zod-client`,
  which runs only on a developer machine against our own schema.

By remaining root dependency, roughly:

| Root package | Advisories pulled in |
| --- | --- |
| `openapi-zod-client` | handlebars (critical/high/mod/low), axios, fast-uri, form-data, js-yaml, ajv, follow-redirects |
| `vite` + plugins + `vitest` | vite, rollup, postcss, picomatch |
| eslint stack | flatted |
| `json-schema-to-typescript` | lodash, js-yaml, picomatch |
| `@arcgis/core` | lodash-es |

## Guiding constraints

From [CLAUDE.md](CLAUDE.md):

- Demonstration app. It should be secure and live, but does not need to be a
  fully scaled production site.
- Must run free or near-free. Avoid changes that increase build or hosting cost.
- Map layer portability matters. Anything done to `@arcgis/core` should reduce,
  not increase, coupling to ESRI APIs.

A practical consequence: dev-only advisories are worth clearing but are not
urgent, whereas anything in `dependencies` deserves more weight.

---

## 1. Move `json-schema-to-typescript` to devDependencies

**Effort:** minutes. **Risk:** very low. Do this first.

It currently sits in `dependencies` in [frontend/package.json](frontend/package.json)
but is only invoked by the `schema-json-to-ts` script. Verified: nothing under
`frontend/src/` imports it — the only mentions are in a generated header comment
in [frontend/src/types/django_api_types.ts](frontend/src/types/django_api_types.ts).

- [ ] `pnpm remove json-schema-to-typescript && pnpm add -D json-schema-to-typescript`
- [ ] Confirm `pnpm run schema-json-to-ts` still works
- [ ] Confirm `pnpm run build` output is unchanged

Removes lodash / js-yaml / picomatch from the production dependency graph. Does
not change the audit total (audit covers dev too), but it does shrink what could
ever reach a user.

## 2. Vite 8 + plugin-react 6 + vite-tsconfig-paths 6

**Effort:** medium. **Risk:** medium. Must move together.

- `vite` 7.0.5 → 8.1.5
- `@vitejs/plugin-react` 5.2.0 → 6.0.4 — peer-requires `vite ^8`, which is why
  Tier 2 stopped at 5.x
- `vite-tsconfig-paths` 5.1.4 → 6.1.1 (peer `vite: *`, so it is flexible)
- `vitest` will need a compatible major if 4.x does not support Vite 8

Note that `@vitejs/plugin-react@6` also declares peers on `@rolldown/plugin-babel`
and `babel-plugin-react-compiler`, which suggests the Rolldown transition. Read
the migration guide before starting — this is the item most likely to have moved
since this plan was written.

- [ ] Check whether `vitest` 4.x supports Vite 8; bump if not
- [ ] Upgrade all four together in one commit
- [ ] Verify the ESRI asset handling in [frontend/vite.config.ts](frontend/vite.config.ts)
      still resolves — the build copies `@arcgis/core` assets and is the most
      likely thing to break
- [ ] Check the `terser` minify path still applies; Rolldown may change defaults
- [ ] Compare bundle output size against the current build before merging

Clears the vite / rollup / postcss / picomatch cluster — the largest single block
of remaining high findings.

## 3. TypeScript 5.8 → 7.0

**Effort:** medium. **Risk:** medium. Do alone, not bundled with anything else.

A major compiler generation. Do it as an isolated PR so that any fallout is
unambiguously attributable.

- [ ] Bump `typescript` and run `pnpm run typecheck`
- [ ] Expect fallout in the generated Zodios client
      ([frontend/src/generatedtypes/](frontend/src/generatedtypes/)) — it is large,
      machine-generated, and heavy on inference
- [ ] Confirm `typescript-eslint` supports TS 7 before starting; if not, this is
      blocked on that release
- [ ] Watch build memory. The build already needs
      `NODE_OPTIONS=--max-old-space-size=8192`

## 4. MUI 7 → 9

**Effort:** large. **Risk:** medium-high. Two majors across every UI surface.

`@mui/material` and `@mui/icons-material` 7.3.11 → 9.2.0, moving with
`@emotion/react` and `@emotion/styled`.

- [ ] Read both the 7→8 and 8→9 migration guides; check whether the codemods
      cover our usage
- [ ] Pay attention to `slotProps` / `slots`. We already hit a related typing
      change during Tier 1 — `maxLength` had to move from `slotProps.input` to
      `slotProps.htmlInput` in
      [frontend/src/components/routes/PhotoUploadStep.tsx](frontend/src/components/routes/PhotoUploadStep.tsx)
- [ ] Check the theme setup and any `sx` overrides that rely on internal class names
- [ ] Visual pass over: route detail, the upload wizard, photo gallery, elevation
      profile, and the mobile fullscreen map layout

There is no security pressure here — MUI contributes only a transitive `yaml`
moderate. This is upkeep, so schedule it when there is appetite for UI QA.

## 5. `@arcgis/core` 4.33 → 5.x

**Effort:** large. **Risk:** high. The only remaining runtime-facing advisory.

This is the one upgrade with a genuine user-facing security argument: the
`lodash-es` high and moderate findings reach shipped code only through this
package.

- [ ] Read the 4.x → 5.x migration guide and inventory the breaking changes
- [ ] Inventory our ESRI surface area first. Per the portability goal, map
      components should be thin wrappers — this upgrade is a good forcing function
      to check whether that is still true. Main touch points:
      [frontend/src/components/map/](frontend/src/components/map/),
      [frontend/src/hooks/useRouteAnimation.ts](frontend/src/hooks/useRouteAnimation.ts),
      [frontend/src/hooks/useElevationProfile.ts](frontend/src/hooks/useElevationProfile.ts)
- [ ] Verify the asset-copying build step against the new package layout
- [ ] Check bundle size. ArcGIS already dominates the build — several chunks
      exceed the 3000 kB warning threshold
- [ ] Manually exercise: route rendering, 2D/3D toggle, photo graphics layer,
      animation playback, elevation hover

Consider whether the effort is better spent on the Leaflet/Mapbox migration that
[plans/adr-hosting-and-geojson-storage.md](plans/adr-hosting-and-geojson-storage.md)
contemplates. Canonical route geometry is already GeoJSON, so that option stays open.

## 6. Zod 4 — blocked, needs a decision

**Effort:** large. **Risk:** high. This is a replacement project, not an upgrade.

`zod` 3.25.76 → 4.4.3 is blocked by Zodios, and the block is harder than it first
looks:

- `@zodios/core@10.9.6` (latest stable) peer-requires `zod: ^3.x`
- `@zodios/core@11.0.0-beta.19` (latest beta) **also** peer-requires `zod: ^3.x`

So there is no Zodios release, stable or pre-release, that accepts Zod 4. Waiting
is not a strategy. Getting to Zod 4 means replacing the API client layer:
[frontend/src/api/](frontend/src/api/) plus the generated client in
[frontend/src/generatedtypes/](frontend/src/generatedtypes/), and the
`schema-to-zod` toolchain in [frontend/package.json](frontend/package.json).

This also resolves item 7, since `openapi-zod-client` goes away with it.

- [ ] Decide whether Zod 4 is actually wanted. Zod 3 is not deprecated and
      carries no advisory of its own. Doing nothing is a legitimate option for a
      demonstration app
- [ ] If yes, evaluate replacements — `openapi-fetch` + `openapi-typescript`,
      `@hey-api/openapi-ts`, or `orval` — against the TanStack Query integration
      already in use
- [ ] Confirm the replacement keeps end-to-end type safety from the DRF schema
- [ ] Plan the migration of every call site off the Zodios client

## 7. `openapi-zod-client` / the handlebars critical

**Effort:** none on its own. Resolved by item 6.

`openapi-zod-client@1.18.3` is the newest release and pulls the remaining
critical (`handlebars`) plus axios, fast-uri, form-data, js-yaml, ajv and
follow-redirects findings.

Worth keeping in perspective: it is a codegen tool run manually by a developer
against our own OpenAPI schema. It never runs in CI, never runs in production,
and never processes untrusted input. The critical severity badge overstates the
real risk here. If item 6 is declined, this stays as accepted risk — record that
decision rather than leaving it looking unaddressed.

---

## Deferred cleanups (not upgrades)

Small things noticed during Tiers 1-2 that do not belong to any item above:

- [ ] **`pnpm run build` is broken at its final step.** The `build` script chains
      `pnpm run copy-esri-assets`, but no such script exists in
      [frontend/package.json](frontend/package.json). `vite build` completes and
      then the chained call errors. Pre-existing, unrelated to the upgrades.
      Either restore the script or drop it from the chain.
- [ ] **Remove the `@typescript-eslint/utils` override** in
      [frontend/pnpm-workspace.yaml](frontend/pnpm-workspace.yaml) once
      `@tanstack/eslint-plugin-router` ships a release supporting ESLint 10. It
      currently pins 8.38, which throws on load under ESLint 10.
- [ ] **Re-enable `react-refresh/only-export-components` under `src/routes/**`**
      if react-refresh gains a TanStack-Router-aware option. It is scoped off in
      [frontend/eslint.config.js](frontend/eslint.config.js) because the
      `localComponents` check fires on every file route.
- [ ] **Two standing lint warnings** — a `no-param-reassign` in
      [frontend/src/api/axiosInstance.ts](frontend/src/api/axiosInstance.ts) and an
      unused eslint-disable directive in
      [frontend/src/types/django_api_types.ts](frontend/src/types/django_api_types.ts).

## Suggested sequencing

1. Item 1 (minutes, no risk)
2. Item 2 — biggest audit reduction per unit of effort
3. Item 3 — needed before item 4 anyway, since MUI 9 will want a recent TS
4. Decide item 6 before scheduling items 4 or 5; if Zod 4 is declined, the
   remaining work is pure upkeep and can be paced accordingly
5. Items 4 and 5 last, each behind a manual QA pass

## Verification checklist (every item)

The frontend has thin test coverage — 23 tests over pure utility functions only,
with no component or hook tests. Typecheck, lint and build are the real safety
net, and none of them catch behavioural regressions. Manual QA is not optional
for items 4 and 5.

- [ ] `pnpm run typecheck` clean
- [ ] `pnpm run lint` reports 0 errors
- [ ] `pnpm exec vitest run` — 23/23 pass
- [ ] `pnpm exec vite build` succeeds
- [ ] `pnpm peers check` reports no issues
- [ ] `pnpm audit` — record the before/after counts in the commit message
- [ ] Manual pass over the route detail page for anything touching UI or the map

> Note: on WSL, make sure `which pnpm` resolves to the nvm-managed Node under
> `~/.nvm/versions/node/*/bin` and not the Windows install at `/mnt/c/nvm4w`.
> The latter fails with `exec: node: Permission denied`. `~/.bashrc` now loads
> nvm above its non-interactive guard so that non-interactive shells get the
> right one.
