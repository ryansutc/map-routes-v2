import { expect, test } from "vitest";
import {
  formatDate,
  formatDateTimeForZone,
  zonedLocalDateTimeToIso,
} from "./datetimeHelpers";

test("labels a missing GPX activity date", () => {
  expect(formatDate(null)).toBe("Date unavailable");
});

test("formats ISO string as yyyy-mm-dd by default", () => {
  expect(formatDate("2007-04-25T07:00:00.000Z")).toBe("2007-04-25");
});

test("formats ISO string as long month/day/year", () => {
  expect(formatDate("2007-04-25T07:00:00.000Z", "mmm-dd-yyyy")).toBe(
    "April 25, 2007",
  );
});

test("formats an instant as local wall time in its interpretation zone", () => {
  expect(
    formatDateTimeForZone("2024-07-01T19:30:00Z", "America/Vancouver"),
  ).toBe("2024-07-01T12:30:00");
});

test("converts historical summer and winter local times to aware instants", () => {
  expect(
    zonedLocalDateTimeToIso("2024-07-01T12:00:00", "America/Vancouver"),
  ).toBe("2024-07-01T19:00:00.000Z");
  expect(
    zonedLocalDateTimeToIso("2024-01-01T12:00:00", "America/Vancouver"),
  ).toBe("2024-01-01T20:00:00.000Z");
});

test("refuses ambiguous and nonexistent local times", () => {
  expect(() =>
    zonedLocalDateTimeToIso("2024-11-03T01:30:00", "America/Vancouver"),
  ).toThrow("occurs twice");
  expect(() =>
    zonedLocalDateTimeToIso("2024-03-10T02:30:00", "America/Vancouver"),
  ).toThrow("does not exist");
});
