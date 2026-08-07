import { describe, expect, it } from "vitest";
import { buildRouteTrack, type TimedTrack } from "./timedTrack";

type Coordinate = [number, number, number?];

function routeGeoJson(
  segments: Coordinate[][],
  coordinateTimes?: ReadonlyArray<ReadonlyArray<string | null> | undefined>,
) {
  return {
    type: "FeatureCollection",
    features: segments.map((coordinates, index) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties:
        coordinateTimes?.[index] === undefined
          ? {}
          : { coordinate_times: coordinateTimes[index] },
    })),
  };
}

function timedTrack(
  segments: Coordinate[][],
  coordinateTimes: ReadonlyArray<ReadonlyArray<string | null>>,
): TimedTrack {
  const track = buildRouteTrack(routeGeoJson(segments, coordinateTimes));
  expect(track.kind).toBe("timed");
  if (track.kind !== "timed")
    throw new Error(`Expected timed track: ${track.reason}`);
  return track;
}

describe("buildRouteTrack capability", () => {
  it("accepts aligned globally nondecreasing absolute times across segments", () => {
    const track = timedTrack(
      [
        [
          [0, 0, 10],
          [0.001, 0, 20],
        ],
        [[1, 1, 30]],
      ],
      [
        ["2026-01-01T00:00:00Z", "2026-01-01T00:00:05+00:00"],
        ["2026-01-01T00:00:05Z"],
      ],
    );

    expect(track.segments).toHaveLength(2);
    expect(track.points).toHaveLength(3);
    expect(track.originalDurationMs).toBe(5_000);
    expect(track.points.map((point) => point.timestampMs)).toEqual([
      Date.parse("2026-01-01T00:00:00Z"),
      Date.parse("2026-01-01T00:00:05Z"),
      Date.parse("2026-01-01T00:00:05Z"),
    ]);
  });

  it.each([
    ["missing arrays", undefined, "missing-coordinate-times"],
    [
      "missing point time",
      [["2026-01-01T00:00:00Z", null]],
      "missing-coordinate-times",
    ],
    [
      "misaligned arrays",
      [["2026-01-01T00:00:00Z"]],
      "misaligned-coordinate-times",
    ],
    [
      "malformed time",
      [["2026-01-01T00:00:00Z", "not-a-time"]],
      "invalid-coordinate-time",
    ],
    [
      "impossible calendar time",
      [["2026-01-01T00:00:00Z", "2026-02-30T00:00:00Z"]],
      "invalid-coordinate-time",
    ],
    [
      "timezone-less time",
      [["2026-01-01T00:00:00Z", "2026-01-01T00:00:01"]],
      "invalid-coordinate-time",
    ],
    [
      "backward time",
      [["2026-01-01T00:00:01Z", "2026-01-01T00:00:00Z"]],
      "backward-coordinate-time",
    ],
  ] as const)("classifies %s as legacy", (_label, times, reason) => {
    const track = buildRouteTrack(
      routeGeoJson(
        [
          [
            [0, 0],
            [0.001, 0],
          ],
        ],
        times,
      ),
    );

    expect(track).toMatchObject({ kind: "legacy", reason });
    expect(track.profilePoints).toHaveLength(2);
  });

  it("derives profile and timing data without mutating canonical observations", () => {
    const canonical = routeGeoJson(
      [
        [
          [0, 0, 10],
          [0.001, 0, 20],
        ],
      ],
      [["2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z"]],
    );
    const before = JSON.stringify(canonical);

    buildRouteTrack(canonical);

    expect(JSON.stringify(canonical)).toBe(before);
  });
});

describe("TimedTrack lookup", () => {
  it("interpolates by recorded time and resolves zero-duration pairs deterministically", () => {
    const track = timedTrack(
      [
        [
          [0, 0],
          [0.001, 0],
          [0.002, 0],
        ],
      ],
      [
        [
          "2026-01-01T00:00:00Z",
          "2026-01-01T00:00:10Z",
          "2026-01-01T00:00:10Z",
        ],
      ],
    );

    expect(track.atOriginalElapsed(5_000).coordinate[0]).toBeCloseTo(0.0005);
    expect(track.atTimestamp(Date.parse("2026-01-01T00:00:10Z"))).toMatchObject(
      {
        pointIndex: 2,
        coordinate: [0.002, 0],
      },
    );
  });

  it("adds no distance or interpolation across a separated segment gap", () => {
    const track = timedTrack(
      [
        [
          [0, 0],
          [0.001, 0],
        ],
        [
          [1, 1],
          [1.001, 1],
        ],
      ],
      [
        ["2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z"],
        ["2026-01-01T00:01:40Z", "2026-01-01T00:01:50Z"],
      ],
    );

    expect(track.gaps).toHaveLength(1);
    expect(track.gaps[0]!.durationMs).toBe(90_000);
    expect(track.atOriginalElapsed(50_000).coordinate).toEqual([0.001, 0]);
    expect(track.atMovingElapsed(10_000).coordinate).toEqual([1, 1]);
    expect(track.profilePoints[1]!.distance).toBe(
      track.profilePoints[2]!.distance,
    );
    expect(track.totalDistanceM).toBeLessThan(300);
  });

  it("interpolates by cumulative within-segment distance", () => {
    const track = timedTrack(
      [
        [
          [0, 0],
          [0.001, 0],
          [0.003, 0],
        ],
      ],
      [
        [
          "2026-01-01T00:00:00Z",
          "2026-01-01T00:00:10Z",
          "2026-01-01T00:00:20Z",
        ],
      ],
    );

    const cursor = track.atDistance(track.totalDistanceM / 2);
    expect(cursor.coordinate[0]).toBeCloseTo(0.0015);
    expect(cursor.cumulativeDistanceM).toBeCloseTo(track.totalDistanceM / 2);
  });
});

describe("TimedTrack stops", () => {
  it("derives a stable stop anchor and collapses its moving time", () => {
    const track = timedTrack(
      [
        [
          [0, 0],
          [0.00004, 0],
          [0.00002, 0],
          [0.001, 0],
        ],
      ],
      [
        [
          "2026-01-01T00:00:00Z",
          "2026-01-01T00:01:00Z",
          "2026-01-01T00:02:00Z",
          "2026-01-01T00:02:01Z",
        ],
      ],
    );

    expect(track.stops).toHaveLength(1);
    expect(track.stops[0]!.durationMs).toBe(120_000);
    expect(track.movingDurationMs).toBe(1_000);
    const firstCursor = track.atOriginalElapsed(30_000);
    const secondCursor = track.atOriginalElapsed(90_000);
    expect(firstCursor.coordinate).toEqual(track.stops[0]!.anchor);
    expect(secondCursor.coordinate).toEqual(track.stops[0]!.anchor);
    expect(firstCursor.stopIndex).toBe(0);
    expect(track.atOriginalElapsed(120_000).coordinate).toEqual([0.00002, 0]);
  });

  it("applies the fixed stay radius and minimum duration at their boundaries", () => {
    const atThreshold = timedTrack(
      [
        [
          [0, 0],
          [0.00017, 0],
        ],
      ],
      [["2026-01-01T00:00:00Z", "2026-01-01T00:01:30Z"]],
    );
    const tooShort = timedTrack(
      [
        [
          [0, 0],
          [0.00017, 0],
        ],
      ],
      [["2026-01-01T00:00:00.000Z", "2026-01-01T00:01:29.999Z"]],
    );
    const tooFar = timedTrack(
      [
        [
          [0, 0],
          [0.00019, 0],
        ],
      ],
      [["2026-01-01T00:00:00Z", "2026-01-01T00:01:30Z"]],
    );

    expect(atThreshold.stops).toHaveLength(1);
    expect(tooShort.stops).toHaveLength(0);
    expect(tooFar.stops).toHaveLength(0);
  });

  it("can detect one stop across nearby segment endpoints", () => {
    const track = timedTrack(
      [[[0, 0]], [[0.00004, 0]]],
      [["2026-01-01T00:00:00Z"], ["2026-01-01T00:02:00Z"]],
    );

    expect(track.gaps).toHaveLength(0);
    expect(track.stops).toHaveLength(1);
    expect(track.stops[0]!.anchor).toEqual([0, 0]);
    expect(track.atDistance(0).coordinate).toEqual([0, 0]);
  });
});

it("preprocesses a large synthetic track through the public interface", () => {
  const pointCount = 50_000;
  const startedAtMs = Date.parse("2026-01-01T00:00:00Z");
  const coordinates: Coordinate[] = [];
  const times: string[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    coordinates.push([index * 0.0003, 0, index % 100]);
    times.push(new Date(startedAtMs + index * 1_000).toISOString());
  }

  const track = buildRouteTrack(routeGeoJson([coordinates], [times]));

  expect(track.kind).toBe("timed");
  expect(track.profilePoints).toHaveLength(pointCount);
  expect(track.totalDistanceM).toBeGreaterThan(0);
});
