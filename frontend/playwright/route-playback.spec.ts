import { expect, test } from "@playwright/test";

const route = {
  id: 1,
  title: "Playwright test route",
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

test("plays a route and shows its completion distance", async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[browser console] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.error(`[browser page error] ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    console.error(
      `[request failed] ${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
    );
  });

  console.log("[checkpoint] Installing API stubs");
  await page.route("**/api/auth/status/", (request) =>
    request.fulfill({ json: { is_authenticated: false, user_name: null } }),
  );
  await page.route("**/api/route/", (request) =>
    request.fulfill({ json: [route] }),
  );
  await page.route("**/api/route/1/", (request) =>
    request.fulfill({ json: route }),
  );

  console.log("[checkpoint] Opening routes page");
  await page.goto("/routes");
  console.log("[checkpoint] Routes page loaded; selecting test route");
  await page.getByRole("button", { name: route.title }).click();
  console.log("[checkpoint] Test route selected; opening playback settings");
  await page.getByRole("button", { name: "Open settings" }).click();

  await page.getByRole("combobox", { name: "Target route duration" }).click();
  await page.getByRole("option", { name: "10 seconds" }).click();
  await page
    .getByRole("combobox", { name: "Preferred playback mode" })
    .click();
  await page.getByRole("option", { name: "Constant speed" }).click();
  await page.getByRole("switch", { name: "Show timed photos" }).uncheck();
  await page.getByRole("button", { name: "Close settings" }).click();
  console.log("[checkpoint] Settings saved; starting route playback");
  await page.getByRole("button", { name: "Replay route" }).click();

  console.log("[checkpoint] Waiting for route playback completion");
  await expect(page.getByTestId("completion-distance")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("completion-distance")).toHaveText("12.50 km");
  console.log("[checkpoint] Route playback completed with expected distance");
});
