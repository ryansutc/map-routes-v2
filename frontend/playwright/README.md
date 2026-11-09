# Playwright end-to-end tests

From `frontend/`, install the browser once and run the suite:

```sh
pnpm exec playwright install chromium
pnpm exec playwright test
```

Playwright starts the Vite development server. The route playback test stubs the
backend API responses; the map still uses ArcGIS services, so a network connection
is needed to load the map.

Useful commands:

```sh
pnpm exec playwright test --ui
pnpm exec playwright show-report
```

Useful commands to build new tests:
(from `frontend/`)

```
npx playwright codegen
```
