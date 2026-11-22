import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const route = {
  id: 1,
  title: "Playwright accessibility route",
  activity_type: "Hiking",
  activity_date: "2026-01-01T00:00:00Z",
  distance: 12_500,
  duration: 3_600,
  elevation_gain: "250.00",
  track_point_count: 2,
  owner: "playwright@example.com",
  is_public: true,
  photos: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  geojson: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [-123.1, 49.2, 0],
        [-122.929, 49.2, 250],
      ],
    },
  },
};

async function expectNoAccessibilityViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations, `Accessibility violations in ${state}`).toEqual(
    [],
  );
}

test("routes, settings, and route detail have no axe accessibility violations", async ({
  page,
}) => {
  // Ensure that a navigation through the main public pages don't
  // reveal any common accessibility issues via axe-core
  await page.route("**/api/auth/status/", (request) =>
    request.fulfill({ json: { is_authenticated: false, user_name: null } }),
  );
  await page.route("**/api/route/", (request) =>
    request.fulfill({ json: [route] }),
  );
  await page.route("**/api/route/1/", (request) =>
    request.fulfill({ json: route }),
  );

  await page.goto("/routes");
  await expect(page.getByRole("button", { name: route.title })).toBeVisible();
  await expectNoAccessibilityViolations(page, "the routes page");

  await page.getByRole("button", { name: "Open settings" }).click();
  const settingsDialog = page.getByRole("dialog");
  await expect(settingsDialog).toBeVisible();
  await expect(page.locator(".MuiDialog-container")).toHaveCSS(
    "opacity",
    "1",
  );
  await expectNoAccessibilityViolations(page, "the open settings dialog");
  await page.getByRole("switch", { name: "Dark mode" }).check();
  await expectNoAccessibilityViolations(page, "dark mode settings");
  await page.getByRole("button", { name: "Close settings" }).click();

  await page.getByRole("button", { name: route.title }).click();
  await expect(
    page.getByRole("button", { name: "Replay route" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, "the route detail page");
});
