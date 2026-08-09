type formatType = "yyyy-mm-dd" | "mmm-dd-yyyy" | "mmm-yyyy";
/**
 * Take a date object or ISO string like 2007-04-25T07:00:00.000Z
 * and format it as YYY-MM-DD for pretty display.
 *
 * Does not respect local timezone, always returns UTC date.
 *
 * @param date
 * @returns yyy-mm-dd
 */
/**
 * Formats a date value for display as a short, consistent string.
 *
 * This is a local frontend utility in this file and is used for route/date display in the app.
 *
 * @param dateString The date value to format, such as an ISO timestamp or Date object.
 * @param format The output format to use for the date string.
 * @returns A formatted date string, or a fallback message when the input is missing.
 */
export const formatDate = (
  dateString: string | Date | null | undefined,
  format: formatType = "yyyy-mm-dd",
): string => {
  if (dateString == null) return "Date unavailable";
  const date = new Date(dateString);
  if (format === "mmm-dd-yyyy") {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  } else if (format === "mmm-yyyy") {
    // return a date string in the format of "April 2023"
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: undefined,
    };
    return date.toLocaleDateString("en-US", options);
  }

  return date.toISOString().split("T")[0]!;
};

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Converts an instant into a wall-clock datetime string in a specific timezone.
 *
 * Used by the frontend timezone display helpers in this file to render route timestamps in the selected zone.
 *
 * @param instant The UTC instant to convert.
 * @param timeZone The IANA timezone name to format the instant in.
 * @returns A datetime string in the target timezone, or an empty string for invalid input.
 */
export function formatDateTimeForZone(
  instant: string | null | undefined,
  timeZone: string | null | undefined,
): string {
  if (!instant || !timeZone) return "";
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  const parts = partsInZone(date, timeZone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

/**
 * Converts a local datetime string in a timezone back to a UTC ISO instant.
 *
 * Used when saving or editing a route timestamp in a local timezone and needing the canonical UTC value.
 *
 * @param localValue The local date and time in the target timezone.
 * @param timeZone The timezone that the local value belongs to.
 * @returns The corresponding UTC ISO timestamp.
 */
export function zonedLocalDateTimeToIso(
  localValue: string,
  timeZone: string,
): string {
  const local = parseLocalDateTime(localValue);
  const wallClockMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 3) {
    offsets.add(
      offsetAt(new Date(wallClockMs + hours * 60 * 60 * 1000), timeZone),
    );
  }

  const candidates = [...offsets]
    .map((offset) => new Date(wallClockMs - offset))
    .filter((candidate) => sameParts(partsInZone(candidate, timeZone), local));
  const uniqueCandidates = [
    ...new Map(
      candidates.map((candidate) => [candidate.getTime(), candidate]),
    ).values(),
  ];

  if (uniqueCandidates.length !== 1) {
    throw new Error(
      uniqueCandidates.length === 0
        ? `That local time does not exist in ${timeZone}.`
        : `That local time occurs twice in ${timeZone}; choose an unambiguous time.`,
    );
  }
  return uniqueCandidates[0]!.toISOString();
}

/**
 * Parses a local datetime string and validates that the pieces form a real date/time.
 *
 * This is a helper used only inside the timezone conversion logic in this file.
 *
 * @param value A local datetime string in YYYY-MM-DDTHH:mm[:ss] format.
 * @returns The validated year, month, day, and time values.
 */
function parseLocalDateTime(value: string): DateTimeParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) throw new Error("Enter a complete local date and time.");
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const roundTrip = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  if (
    roundTrip.getUTCFullYear() !== parts.year ||
    roundTrip.getUTCMonth() + 1 !== parts.month ||
    roundTrip.getUTCDate() !== parts.day ||
    roundTrip.getUTCHours() !== parts.hour ||
    roundTrip.getUTCMinutes() !== parts.minute ||
    roundTrip.getUTCSeconds() !== parts.second
  ) {
    throw new Error("Enter a valid local date and time.");
  }
  return parts;
}

/**
 * Reads the calendar and clock values for a date in a target timezone.
 *
 * Internal helper for the timezone conversion functions in this file.
 *
 * @param date The instant to inspect.
 * @param timeZone The timezone to read values from.
 * @returns The year, month, day, hour, minute, and second in that timezone.
 */
function partsInZone(date: Date, timeZone: string): DateTimeParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as DateTimeParts;
}

/**
 * Computes the UTC offset for a date in a specific timezone.
 *
 * This helper is used internally to resolve timezone ambiguity and DST transitions in this file.
 *
 * @param date The instant to evaluate.
 * @param timeZone The timezone to calculate the offset for.
 * @returns The offset in milliseconds between UTC and the target timezone at that instant.
 */
function offsetAt(date: Date, timeZone: string): number {
  const parts = partsInZone(date, timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

/**
 * Compares two datetime-part objects for equality.
 *
 * Internal comparison helper for timezone candidate matching in this file.
 *
 * @param left The first datetime-part set to compare.
 * @param right The second datetime-part set to compare.
 * @returns True when every calendar and time component matches.
 */
function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (Object.keys(left) as (keyof DateTimeParts)[]).every(
    (key) => left[key] === right[key],
  );
}

/**
 * Pads a number with leading zeros for datetime string output.
 *
 * Internal formatting helper used by the timezone formatting functions in this file.
 *
 * @param value The numeric value to format.
 * @param length The target minimum width for the final string.
 * @returns A zero-padded string.
 */
function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}
