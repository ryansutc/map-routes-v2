import { expect, test } from "vitest";
import { formatDate } from "./datetimeHelpers";
test("formats ISO string as yyyy-mm-dd by default", () => {
  expect(formatDate("2007-04-25T07:00:00.000Z")).toBe("2007-04-25");
});

test("formats ISO string as long month/day/year", () => {
  expect(formatDate("2007-04-25T07:00:00.000Z", "mmm-dd-yyyy")).toBe(
    "April 25, 2007",
  );
});
