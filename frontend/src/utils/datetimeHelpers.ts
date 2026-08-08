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

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (Object.keys(left) as (keyof DateTimeParts)[]).every(
    (key) => left[key] === right[key],
  );
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}
