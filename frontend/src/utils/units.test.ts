import { expect, test } from "vitest";
import { formatDistance, formatElevation, formatPace } from "./units";

test("formatDistance converts meters to km", () => {
  expect(formatDistance(5000, "metric")).toBe("5.00 km");
});

test("formatDistance converts meters to miles", () => {
  expect(formatDistance(1609.344, "imperial")).toBe("1.00 mi");
});

test("formatElevation returns dash for null", () => {
  expect(formatElevation(null, "metric")).toBe("—");
});

test("formatElevation converts meters to feet", () => {
  expect(formatElevation(100, "imperial")).toBe("328 ft");
});

test("formatPace returns metric min/km", () => {
  expect(formatPace(5.0, "metric")).toBe("5.00 min/km");
});

test("formatPace converts to min/mi", () => {
  expect(formatPace(5.0, "imperial")).toBe("8.05 min/mi");
});
