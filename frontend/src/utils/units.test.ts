import { expect, test } from "vitest";
import {
  distanceAxisTicks,
  formatDistance,
  formatDistanceTick,
  formatElevation,
  formatPace,
  niceDistanceStep,
} from "./units";

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

test("niceDistanceStep picks a round step in the current unit", () => {
  expect(niceDistanceStep(5300, "metric")).toBe(1); // 5.3 km -> 1 km steps
  expect(niceDistanceStep(48000, "metric")).toBe(10); // 48 km -> 10 km steps
  expect(niceDistanceStep(5300, "imperial")).toBe(1); // 3.3 mi -> 1 mi steps
});

test("distanceAxisTicks rounds the axis up to whole kilometers", () => {
  const { max, ticks } = distanceAxisTicks(5300, "metric");
  expect(max).toBe(6000);
  expect(ticks).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000]);
});

test("distanceAxisTicks rounds the axis up to whole miles", () => {
  const { max, ticks } = distanceAxisTicks(5300, "imperial");
  expect(max).toBeCloseTo(4 * 1609.344, 3); // 3.3 mi -> 4 mi
  expect(ticks).toHaveLength(5);
  expect(ticks[1]).toBeCloseTo(1609.344, 3);
});

test("formatDistanceTick drops trailing zeros", () => {
  expect(formatDistanceTick(1000, "metric")).toBe("1 km");
  expect(formatDistanceTick(804.672, "imperial")).toBe("0.5 mi");
});
