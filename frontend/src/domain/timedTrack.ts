const STOP_RADIUS_METERS = 20;
const STOP_MIN_DURATION_MS = 90_000;

export type TrackCoordinate = readonly [
  longitude: number,
  latitude: number,
  elevation?: number,
];

export type TrackCapabilityReason =
  | "no-route-data"
  | "invalid-coordinate"
  | "missing-coordinate-times"
  | "misaligned-coordinate-times"
  | "invalid-coordinate-time"
  | "backward-coordinate-time";

export type TrackProfilePoint = {
  distance: number;
  elevation: number;
  lon: number;
  lat: number;
  segmentIndex: number;
  pointIndex: number;
};

export type TimedTrackPoint = TrackProfilePoint & {
  coordinate: TrackCoordinate;
  timestampMs: number;
  originalElapsedMs: number;
  movingElapsedMs: number;
};

export type TimedTrackSegment = {
  index: number;
  startPointIndex: number;
  endPointIndex: number;
};

export type DetectedStop = {
  index: number;
  startPointIndex: number;
  endPointIndex: number;
  startTimestampMs: number;
  endTimestampMs: number;
  startOriginalElapsedMs: number;
  endOriginalElapsedMs: number;
  durationMs: number;
  anchor: TrackCoordinate;
  cumulativeDistanceM: number;
};

export type UnknownTrackGap = {
  index: number;
  fromPointIndex: number;
  toPointIndex: number;
  startTimestampMs: number;
  endTimestampMs: number;
  startOriginalElapsedMs: number;
  endOriginalElapsedMs: number;
  durationMs: number;
};

export type TrackCursor = {
  coordinate: TrackCoordinate;
  segmentIndex: number;
  pointIndex: number;
  nextPointIndex: number | null;
  interpolationFraction: number;
  timestampMs: number;
  originalElapsedMs: number;
  movingElapsedMs: number;
  cumulativeDistanceM: number;
  stopIndex: number | null;
};

type RouteTrackBase = {
  profilePoints: readonly TrackProfilePoint[];
  totalDistanceM: number;
};

export type LegacyTrack = RouteTrackBase & {
  kind: "legacy";
  reason: TrackCapabilityReason;
};

export type TimedTrack = RouteTrackBase & {
  kind: "timed";
  startedAtMs: number;
  endedAtMs: number;
  originalDurationMs: number;
  movingDurationMs: number;
  points: readonly TimedTrackPoint[];
  segments: readonly TimedTrackSegment[];
  stops: readonly DetectedStop[];
  gaps: readonly UnknownTrackGap[];
  atTimestamp: (timestampMs: number) => TrackCursor;
  atOriginalElapsed: (elapsedMs: number) => TrackCursor;
  atMovingElapsed: (elapsedMs: number) => TrackCursor;
  atDistance: (distanceM: number) => TrackCursor;
};

export type RouteTrack = LegacyTrack | TimedTrack;

type RawSegment = {
  coordinates: TrackCoordinate[];
  coordinateTimes: unknown[] | null;
  hasInvalidCoordinate: boolean;
};

type CollapsedInterval = {
  startMs: number;
  endMs: number;
  durationMs: number;
  collapsedBeforeMs: number;
  movingStartMs: number;
};

type MutableTimedPoint = Omit<TimedTrackPoint, "movingElapsedMs"> & {
  movingElapsedMs: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const ABSOLUTE_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/i;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseAbsoluteTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ABSOLUTE_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toCoordinate(value: unknown): TrackCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = value[0];
  const latitude = value[1];
  const elevation = value[2];
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    (elevation !== undefined &&
      (typeof elevation !== "number" || !Number.isFinite(elevation)))
  ) {
    return null;
  }
  return elevation === undefined
    ? [longitude, latitude]
    : [longitude, latitude, elevation];
}

function extractRawSegments(geojson: unknown): RawSegment[] {
  if (!isRecord(geojson)) return [];
  const features =
    geojson.type === "FeatureCollection" && Array.isArray(geojson.features)
      ? geojson.features
      : geojson.type === "Feature"
        ? [geojson]
        : [];
  const segments: RawSegment[] = [];

  for (const feature of features) {
    if (!isRecord(feature) || !isRecord(feature.geometry)) continue;
    const geometry = feature.geometry;
    const properties = isRecord(feature.properties) ? feature.properties : {};
    const rawTimes = properties.coordinate_times;

    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
      segments.push(toRawSegment(geometry.coordinates, rawTimes));
    } else if (
      geometry.type === "MultiLineString" &&
      Array.isArray(geometry.coordinates)
    ) {
      for (let index = 0; index < geometry.coordinates.length; index += 1) {
        const coordinates = geometry.coordinates[index];
        if (!Array.isArray(coordinates)) continue;
        const segmentTimes = Array.isArray(rawTimes) ? rawTimes[index] : null;
        segments.push(toRawSegment(coordinates, segmentTimes));
      }
    }
  }

  return segments.filter((segment) => segment.coordinates.length > 0);
}

function toRawSegment(coordinates: unknown[], rawTimes: unknown): RawSegment {
  const parsedCoordinates: TrackCoordinate[] = [];
  let hasInvalidCoordinate = false;
  for (const value of coordinates) {
    const coordinate = toCoordinate(value);
    if (coordinate) parsedCoordinates.push(coordinate);
    else hasInvalidCoordinate = true;
  }
  return {
    coordinates: parsedCoordinates,
    coordinateTimes: Array.isArray(rawTimes) ? rawTimes : null,
    hasInvalidCoordinate,
  };
}

function haversineMeters(a: TrackCoordinate, b: TrackCoordinate): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b[1] - a[1]);
  const longitudeDelta = toRadians(b[0] - a[0]);
  const firstLatitude = toRadians(a[1]);
  const secondLatitude = toRadians(b[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function buildProfile(segments: readonly RawSegment[]): TrackProfilePoint[] {
  const profile: TrackProfilePoint[] = [];
  let cumulativeDistanceM = 0;
  let pointIndex = 0;
  for (
    let segmentIndex = 0;
    segmentIndex < segments.length;
    segmentIndex += 1
  ) {
    const coordinates = segments[segmentIndex]!.coordinates;
    for (let index = 0; index < coordinates.length; index += 1) {
      const coordinate = coordinates[index]!;
      if (index > 0) {
        cumulativeDistanceM += haversineMeters(
          coordinates[index - 1]!,
          coordinate,
        );
      }
      profile.push({
        distance: cumulativeDistanceM,
        elevation: coordinate[2] ?? 0,
        lon: coordinate[0],
        lat: coordinate[1],
        segmentIndex,
        pointIndex,
      });
      pointIndex += 1;
    }
  }
  return profile;
}

function parseCoordinateTimes(
  segments: readonly RawSegment[],
): { timestamps: number[] } | { reason: TrackCapabilityReason } {
  const timestamps: number[] = [];
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    if (segment.hasInvalidCoordinate) return { reason: "invalid-coordinate" };
    if (segment.coordinateTimes === null) {
      return { reason: "missing-coordinate-times" };
    }
    if (segment.coordinateTimes.length !== segment.coordinates.length) {
      return { reason: "misaligned-coordinate-times" };
    }
    for (const value of segment.coordinateTimes) {
      if (value === null || value === undefined) {
        return { reason: "missing-coordinate-times" };
      }
      const timestamp = parseAbsoluteTimestamp(value);
      if (timestamp === null) return { reason: "invalid-coordinate-time" };
      if (timestamp < previousTimestamp) {
        return { reason: "backward-coordinate-time" };
      }
      timestamps.push(timestamp);
      previousTimestamp = timestamp;
    }
  }
  return { timestamps };
}

function buildTimedPoints(
  segments: readonly RawSegment[],
  profile: readonly TrackProfilePoint[],
  timestamps: readonly number[],
): { points: MutableTimedPoint[]; segments: TimedTrackSegment[] } {
  const points: MutableTimedPoint[] = [];
  const timedSegments: TimedTrackSegment[] = [];
  const startedAtMs = timestamps[0]!;
  let flatIndex = 0;
  for (
    let segmentIndex = 0;
    segmentIndex < segments.length;
    segmentIndex += 1
  ) {
    const startPointIndex = flatIndex;
    for (const coordinate of segments[segmentIndex]!.coordinates) {
      const profilePoint = profile[flatIndex]!;
      const timestampMs = timestamps[flatIndex]!;
      points.push({
        ...profilePoint,
        coordinate,
        timestampMs,
        originalElapsedMs: timestampMs - startedAtMs,
        movingElapsedMs: 0,
      });
      flatIndex += 1;
    }
    timedSegments.push({
      index: segmentIndex,
      startPointIndex,
      endPointIndex: flatIndex - 1,
    });
  }
  return { points, segments: timedSegments };
}

function buildUnknownGaps(
  points: readonly TimedTrackPoint[],
  segments: readonly TimedTrackSegment[],
): UnknownTrackGap[] {
  const gaps: UnknownTrackGap[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    const previous = points[segments[index - 1]!.endPointIndex]!;
    const next = points[segments[index]!.startPointIndex]!;
    if (
      haversineMeters(previous.coordinate, next.coordinate) <=
      STOP_RADIUS_METERS
    ) {
      continue;
    }
    gaps.push({
      index: gaps.length,
      fromPointIndex: previous.pointIndex,
      toPointIndex: next.pointIndex,
      startTimestampMs: previous.timestampMs,
      endTimestampMs: next.timestampMs,
      startOriginalElapsedMs: previous.originalElapsedMs,
      endOriginalElapsedMs: next.originalElapsedMs,
      durationMs: next.timestampMs - previous.timestampMs,
    });
  }
  return gaps;
}

function buildStops(
  points: readonly TimedTrackPoint[],
  gaps: readonly UnknownTrackGap[],
): DetectedStop[] {
  if (points.length < 2) return [];
  const gapStarts = new Set(gaps.map((gap) => gap.fromPointIndex));
  const stops: DetectedStop[] = [];
  let start = 0;

  const recordCandidate = (end: number) => {
    if (end <= start) return;
    const first = points[start]!;
    const last = points[end]!;
    const durationMs = last.timestampMs - first.timestampMs;
    if (durationMs < STOP_MIN_DURATION_MS) return;
    stops.push({
      index: stops.length,
      startPointIndex: first.pointIndex,
      endPointIndex: last.pointIndex,
      startTimestampMs: first.timestampMs,
      endTimestampMs: last.timestampMs,
      startOriginalElapsedMs: first.originalElapsedMs,
      endOriginalElapsedMs: last.originalElapsedMs,
      durationMs,
      anchor: first.coordinate,
      cumulativeDistanceM: first.distance,
    });
  };

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const crossesUnknownGap = gapStarts.has(index - 1);
    if (
      !crossesUnknownGap &&
      haversineMeters(points[start]!.coordinate, point.coordinate) <=
        STOP_RADIUS_METERS
    ) {
      continue;
    }

    recordCandidate(index - 1);
    const previous = points[index - 1]!;
    if (
      !crossesUnknownGap &&
      haversineMeters(previous.coordinate, point.coordinate) <=
        STOP_RADIUS_METERS
    ) {
      start = index - 1;
    } else {
      start = index;
    }
  }
  recordCandidate(points.length - 1);
  return stops;
}

function mergeCollapsedIntervals(
  stops: readonly DetectedStop[],
  gaps: readonly UnknownTrackGap[],
): CollapsedInterval[] {
  const stopIntervals = stops.map((stop) => ({
    startMs: stop.startOriginalElapsedMs,
    endMs: stop.endOriginalElapsedMs,
  }));
  const gapIntervals = gaps.map((gap) => ({
    startMs: gap.startOriginalElapsedMs,
    endMs: gap.endOriginalElapsedMs,
  }));
  const intervals: { startMs: number; endMs: number }[] = [];
  let stopIndex = 0;
  let gapIndex = 0;
  while (stopIndex < stopIntervals.length || gapIndex < gapIntervals.length) {
    const stop = stopIntervals[stopIndex];
    const gap = gapIntervals[gapIndex];
    if (
      gap === undefined ||
      (stop !== undefined && stop.startMs <= gap.startMs)
    ) {
      if (stop!.endMs > stop!.startMs) intervals.push(stop!);
      stopIndex += 1;
    } else {
      if (gap.endMs > gap.startMs) intervals.push(gap);
      gapIndex += 1;
    }
  }

  const merged: { startMs: number; endMs: number }[] = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, interval.endMs);
    } else {
      merged.push({ ...interval });
    }
  }

  let collapsedBeforeMs = 0;
  return merged.map((interval) => {
    const durationMs = interval.endMs - interval.startMs;
    const result = {
      ...interval,
      durationMs,
      collapsedBeforeMs,
      movingStartMs: interval.startMs - collapsedBeforeMs,
    };
    collapsedBeforeMs += durationMs;
    return result;
  });
}

function upperBound<T>(
  values: readonly T[],
  target: number,
  select: (value: T) => number,
): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (select(values[middle]!) <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function movingElapsedAtOriginal(
  elapsedMs: number,
  intervals: readonly CollapsedInterval[],
): number {
  const index =
    upperBound(intervals, elapsedMs, (interval) => interval.startMs) - 1;
  if (index < 0) return elapsedMs;
  const interval = intervals[index]!;
  const collapsedWithin = Math.min(
    interval.durationMs,
    Math.max(0, elapsedMs - interval.startMs),
  );
  return elapsedMs - interval.collapsedBeforeMs - collapsedWithin;
}

function originalElapsedAtMoving(
  elapsedMs: number,
  intervals: readonly CollapsedInterval[],
): number {
  const index =
    upperBound(intervals, elapsedMs, (interval) => interval.movingStartMs) - 1;
  if (index < 0) return elapsedMs;
  const interval = intervals[index]!;
  return elapsedMs + interval.collapsedBeforeMs + interval.durationMs;
}

function interpolateCoordinate(
  first: TrackCoordinate,
  second: TrackCoordinate,
  fraction: number,
): TrackCoordinate {
  const longitude = first[0] + (second[0] - first[0]) * fraction;
  const latitude = first[1] + (second[1] - first[1]) * fraction;
  if (first[2] === undefined && second[2] === undefined)
    return [longitude, latitude];
  const firstElevation = first[2] ?? second[2] ?? 0;
  const secondElevation = second[2] ?? first[2] ?? 0;
  return [
    longitude,
    latitude,
    firstElevation + (secondElevation - firstElevation) * fraction,
  ];
}

function cursorAtPoint(
  point: TimedTrackPoint,
  stopIndex: number | null,
): TrackCursor {
  return {
    coordinate: point.coordinate,
    segmentIndex: point.segmentIndex,
    pointIndex: point.pointIndex,
    nextPointIndex: null,
    interpolationFraction: 0,
    timestampMs: point.timestampMs,
    originalElapsedMs: point.originalElapsedMs,
    movingElapsedMs: point.movingElapsedMs,
    cumulativeDistanceM: point.distance,
    stopIndex,
  };
}

function findContainingStop(
  stops: readonly DetectedStop[],
  elapsedMs: number,
): DetectedStop | null {
  const index =
    upperBound(stops, elapsedMs, (stop) => stop.startOriginalElapsedMs) - 1;
  if (index < 0) return null;
  const stop = stops[index]!;
  return elapsedMs <= stop.endOriginalElapsedMs ? stop : null;
}

function findContainingGap(
  gaps: readonly UnknownTrackGap[],
  elapsedMs: number,
): UnknownTrackGap | null {
  const index =
    upperBound(gaps, elapsedMs, (gap) => gap.startOriginalElapsedMs) - 1;
  if (index < 0) return null;
  const gap = gaps[index]!;
  return elapsedMs > gap.startOriginalElapsedMs &&
    elapsedMs < gap.endOriginalElapsedMs
    ? gap
    : null;
}

function createTimedTrack(
  profilePoints: TrackProfilePoint[],
  points: MutableTimedPoint[],
  segments: TimedTrackSegment[],
): TimedTrack {
  const startedAtMs = points[0]!.timestampMs;
  const endedAtMs = points[points.length - 1]!.timestampMs;
  const originalDurationMs = endedAtMs - startedAtMs;
  const gaps = buildUnknownGaps(points, segments);
  const stops = buildStops(points, gaps);
  const collapsedIntervals = mergeCollapsedIntervals(stops, gaps);
  for (const point of points) {
    point.movingElapsedMs = movingElapsedAtOriginal(
      point.originalElapsedMs,
      collapsedIntervals,
    );
  }
  const movingDurationMs = movingElapsedAtOriginal(
    originalDurationMs,
    collapsedIntervals,
  );

  const atOriginalElapsed = (requestedElapsedMs: number): TrackCursor => {
    const elapsedMs = Math.min(
      originalDurationMs,
      Math.max(0, requestedElapsedMs),
    );
    const pointIndex =
      upperBound(points, elapsedMs, (point) => point.originalElapsedMs) - 1;
    const recordedPoint = points[Math.max(0, pointIndex)]!;
    const stop = findContainingStop(stops, elapsedMs);
    if (stop) {
      const point = points[stop.startPointIndex]!;
      return {
        ...cursorAtPoint(point, stop.index),
        coordinate: stop.anchor,
        timestampMs: startedAtMs + elapsedMs,
        originalElapsedMs: elapsedMs,
        movingElapsedMs: movingElapsedAtOriginal(elapsedMs, collapsedIntervals),
        cumulativeDistanceM: stop.cumulativeDistanceM,
      };
    }
    if (recordedPoint.originalElapsedMs === elapsedMs) {
      return cursorAtPoint(recordedPoint, null);
    }

    const gap = findContainingGap(gaps, elapsedMs);
    if (gap) {
      const point = points[gap.fromPointIndex]!;
      return {
        ...cursorAtPoint(point, null),
        timestampMs: startedAtMs + elapsedMs,
        originalElapsedMs: elapsedMs,
        movingElapsedMs: movingElapsedAtOriginal(elapsedMs, collapsedIntervals),
      };
    }

    const first = recordedPoint;
    const second = points[first.pointIndex + 1];
    if (!second || second.segmentIndex !== first.segmentIndex) {
      return cursorAtPoint(first, null);
    }
    const durationMs = second.originalElapsedMs - first.originalElapsedMs;
    if (durationMs <= 0) return cursorAtPoint(second, null);
    const fraction = (elapsedMs - first.originalElapsedMs) / durationMs;
    return {
      coordinate: interpolateCoordinate(
        first.coordinate,
        second.coordinate,
        fraction,
      ),
      segmentIndex: first.segmentIndex,
      pointIndex: first.pointIndex,
      nextPointIndex: second.pointIndex,
      interpolationFraction: fraction,
      timestampMs: startedAtMs + elapsedMs,
      originalElapsedMs: elapsedMs,
      movingElapsedMs: movingElapsedAtOriginal(elapsedMs, collapsedIntervals),
      cumulativeDistanceM:
        first.distance + (second.distance - first.distance) * fraction,
      stopIndex: null,
    };
  };

  const atMovingElapsed = (requestedElapsedMs: number): TrackCursor => {
    const elapsedMs = Math.min(
      movingDurationMs,
      Math.max(0, requestedElapsedMs),
    );
    return atOriginalElapsed(
      originalElapsedAtMoving(elapsedMs, collapsedIntervals),
    );
  };

  const atDistance = (requestedDistanceM: number): TrackCursor => {
    const totalDistanceM = profilePoints[profilePoints.length - 1]!.distance;
    const distanceM = Math.min(totalDistanceM, Math.max(0, requestedDistanceM));
    if (distanceM <= 0) return cursorAtPoint(points[0]!, null);
    if (distanceM >= totalDistanceM) {
      return cursorAtPoint(points[points.length - 1]!, null);
    }
    const pointIndex =
      upperBound(points, distanceM, (point) => point.distance) - 1;
    const first = points[Math.max(0, pointIndex)]!;
    const second = points[first.pointIndex + 1];
    if (!second || second.segmentIndex !== first.segmentIndex) {
      return cursorAtPoint(first, null);
    }
    const span = second.distance - first.distance;
    if (span <= 0) return cursorAtPoint(second, null);
    const fraction = (distanceM - first.distance) / span;
    const originalElapsedMs =
      first.originalElapsedMs +
      (second.originalElapsedMs - first.originalElapsedMs) * fraction;
    return {
      coordinate: interpolateCoordinate(
        first.coordinate,
        second.coordinate,
        fraction,
      ),
      segmentIndex: first.segmentIndex,
      pointIndex: first.pointIndex,
      nextPointIndex: second.pointIndex,
      interpolationFraction: fraction,
      timestampMs: startedAtMs + originalElapsedMs,
      originalElapsedMs,
      movingElapsedMs: movingElapsedAtOriginal(
        originalElapsedMs,
        collapsedIntervals,
      ),
      cumulativeDistanceM: distanceM,
      stopIndex: null,
    };
  };

  return {
    kind: "timed",
    startedAtMs,
    endedAtMs,
    originalDurationMs,
    movingDurationMs,
    totalDistanceM: profilePoints[profilePoints.length - 1]!.distance,
    profilePoints,
    points,
    segments,
    stops,
    gaps,
    atTimestamp: (timestampMs) => atOriginalElapsed(timestampMs - startedAtMs),
    atOriginalElapsed,
    atMovingElapsed,
    atDistance,
  };
}

export function buildRouteTrack(geojson: unknown): RouteTrack {
  const rawSegments = extractRawSegments(geojson);
  const profilePoints = buildProfile(rawSegments);
  const totalDistanceM = profilePoints[profilePoints.length - 1]?.distance ?? 0;
  if (profilePoints.length === 0) {
    return {
      kind: "legacy",
      reason: "no-route-data",
      profilePoints,
      totalDistanceM,
    };
  }
  const parsedTimes = parseCoordinateTimes(rawSegments);
  if ("reason" in parsedTimes) {
    return {
      kind: "legacy",
      reason: parsedTimes.reason,
      profilePoints,
      totalDistanceM,
    };
  }
  const timed = buildTimedPoints(
    rawSegments,
    profilePoints,
    parsedTimes.timestamps,
  );
  return createTimedTrack(profilePoints, timed.points, timed.segments);
}
