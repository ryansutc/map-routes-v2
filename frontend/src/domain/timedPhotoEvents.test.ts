import { describe, expect, it } from "vitest";
import {
  buildRouteTrack,
  type RouteTrack,
  type TimedTrack,
} from "./timedTrack";
import {
  classifyTimedPhotoEligibility,
  groupTimedPhotoEvents,
  planTimedPhotoEvents,
  TIMED_PHOTO_GROUP_WINDOW_MS,
} from "./timedPhotoEvents";

function timedTrack(): TimedTrack {
  const track = buildRouteTrack({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.001, 0],
            [0.002, 0],
          ],
        },
        properties: {
          coordinate_times: [
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:02:00Z",
            "2026-01-01T00:02:01Z",
          ],
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0.01, 0],
            [0.012, 0],
          ],
        },
        properties: {
          coordinate_times: [
            "2026-01-01T00:03:00Z",
            "2026-01-01T00:04:00Z",
          ],
        },
      },
    ],
  });
  if (track.kind !== "timed") throw new Error("Expected a timed track");
  return track;
}

function legacyTrack(): RouteTrack {
  return buildRouteTrack({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0.001, 0],
      ],
    },
    properties: {},
  });
}

function stoppedTrack(): TimedTrack {
  const track = buildRouteTrack({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0.00004, 0],
            [0.002, 0],
          ],
        },
        properties: {
          coordinate_times: [
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:02:00Z",
            "2026-01-01T00:02:01Z",
          ],
        },
      },
    ],
  });
  if (track.kind !== "timed") throw new Error("Expected a timed track");
  return track;
}

describe("classifyTimedPhotoEligibility", () => {
  it("reports every timed-route exclusion reason without losing input order", () => {
    const results = classifyTimedPhotoEligibility(timedTrack(), [
      { id: 1, takenAt: null },
      { id: 2, takenAt: "not-a-date" },
      { id: 3, takenAt: "2026-01-01T00:03:30" },
      { id: 4, takenAt: "2025-12-31T23:59:59Z" },
      { id: 5, takenAt: "2026-01-01T00:04:01Z" },
      { id: 6, takenAt: "2026-01-01T00:02:30Z" },
    ]);

    expect(results).toEqual([
      {
        status: "excluded",
        photoId: 1,
        reason: "missing-or-unresolved-time",
      },
      {
        status: "excluded",
        photoId: 2,
        reason: "missing-or-unresolved-time",
      },
      {
        status: "excluded",
        photoId: 3,
        reason: "missing-or-unresolved-time",
      },
      { status: "excluded", photoId: 4, reason: "before-route" },
      { status: "excluded", photoId: 5, reason: "after-route" },
      { status: "excluded", photoId: 6, reason: "unknown-gap" },
    ]);
  });

  it("classifies every photo on a legacy route with the legacy reason", () => {
    expect(
      classifyTimedPhotoEligibility(legacyTrack(), [
        { id: 1, takenAt: "2026-01-01T00:00:00Z" },
        { id: 2, takenAt: null },
      ]),
    ).toEqual([
      { status: "excluded", photoId: 1, reason: "legacy-route" },
      { status: "excluded", photoId: 2, reason: "legacy-route" },
    ]);
  });

  it("includes exact route and segment boundaries with resolved cursors", () => {
    const results = classifyTimedPhotoEligibility(timedTrack(), [
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:02:01Z" },
      { id: 3, takenAt: "2026-01-01T00:03:00Z" },
      { id: 4, takenAt: "2026-01-01T00:04:00Z" },
    ]);

    expect(results.every((result) => result.status === "eligible")).toBe(true);
    expect(
      results.map((result) =>
        result.status === "eligible" ? result.event.cursor.segmentIndex : null,
      ),
    ).toEqual([0, 0, 1, 1]);
  });
});

describe("planTimedPhotoEvents", () => {
  it("excludes missing, invalid, out-of-range, and strict-gap timestamps", () => {
    const events = planTimedPhotoEvents(timedTrack(), [
      { id: 1, takenAt: null },
      { id: 2, takenAt: "not-a-date" },
      { id: 3, takenAt: "2025-12-31T23:59:59Z" },
      { id: 4, takenAt: "2026-01-01T00:04:01Z" },
      { id: 5, takenAt: "2026-01-01T00:02:30Z" },
      { id: 6, takenAt: "2026-01-01T00:03:30" },
    ]);

    expect(events).toEqual([]);
  });

  it("maps exact points, interpolation, and both segment boundaries", () => {
    const track = timedTrack();
    const events = planTimedPhotoEvents(track, [
      { id: 4, takenAt: "2026-01-01T00:03:00Z" },
      { id: 2, takenAt: "2026-01-01T00:01:00Z" },
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 3, takenAt: "2026-01-01T00:02:01Z" },
      { id: 5, takenAt: "2026-01-01T00:04:00Z" },
    ]);

    expect(events.map((event) => event.photoId)).toEqual([1, 2, 3, 4, 5]);
    expect(events[0]!.cursor).toMatchObject({
      segmentIndex: 0,
      pointIndex: 0,
      coordinate: [0, 0],
      cumulativeDistanceM: 0,
    });
    expect(events[1]!.cursor.coordinate[0]).toBeCloseTo(0.0005);
    expect(events[1]!.cursor.cumulativeDistanceM).toBeCloseTo(
      track.points[1]!.distance / 2,
    );
    expect(events[2]!.cursor).toMatchObject({
      segmentIndex: 0,
      pointIndex: 2,
      coordinate: [0.002, 0],
    });
    expect(events[3]!.cursor).toMatchObject({
      segmentIndex: 1,
      pointIndex: 3,
      coordinate: [0.01, 0],
    });
    expect(events[4]!.cursor).toMatchObject({
      segmentIndex: 1,
      pointIndex: 4,
      coordinate: [0.012, 0],
    });
  });

  it("maps photos in a detected stop to its stable anchor and distance", () => {
    const track = stoppedTrack();
    const event = planTimedPhotoEvents(track, [
      { id: 1, takenAt: "2026-01-01T00:01:00Z" },
    ])[0]!;

    expect(track.stops).toHaveLength(1);
    expect(event.cursor).toMatchObject({
      stopIndex: 0,
      coordinate: track.stops[0]!.anchor,
      cumulativeDistanceM: track.stops[0]!.cumulativeDistanceM,
    });
  });

  it("orders equal timestamps by stable photo id", () => {
    const events = planTimedPhotoEvents(timedTrack(), [
      { id: 9, takenAt: "2026-01-01T00:03:00Z" },
      { id: 2, takenAt: "2026-01-01T00:03:00Z" },
    ]);

    expect(events.map((event) => event.photoId)).toEqual([2, 9]);
  });
});

describe("groupTimedPhotoEvents", () => {
  it("groups consecutive events within the named compressed-playback window", () => {
    const track = timedTrack();
    const events = planTimedPhotoEvents(track, [
      { id: 1, takenAt: "2026-01-01T00:00:00Z" },
      { id: 2, takenAt: "2026-01-01T00:00:10Z" },
      { id: 3, takenAt: "2026-01-01T00:00:20Z" },
      { id: 4, takenAt: "2026-01-01T00:02:00Z" },
    ]);
    const groups = groupTimedPhotoEvents(
      events,
      (event) => event.cursor.originalElapsedMs / track.originalDurationMs,
      20_000,
    );

    expect(TIMED_PHOTO_GROUP_WINDOW_MS).toBe(2_000);
    expect(groups.map((group) => group.events.map((event) => event.photoId))).toEqual([
      [1, 2, 3],
      [4],
    ]);
  });

  it("always groups identical timestamps using stable photo-id order", () => {
    const events = planTimedPhotoEvents(timedTrack(), [
      { id: 9, takenAt: "2026-01-01T00:02:00Z" },
      { id: 2, takenAt: "2026-01-01T00:02:00Z" },
    ]);
    const groups = groupTimedPhotoEvents(events, () => 0, 120_000);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.events.map((event) => event.photoId)).toEqual([2, 9]);
  });

  it("groups photos mapped to the same collapsed stop", () => {
    const track = stoppedTrack();
    const events = planTimedPhotoEvents(track, [
      { id: 1, takenAt: "2026-01-01T00:00:10Z" },
      { id: 2, takenAt: "2026-01-01T00:01:50Z" },
    ]);
    const groups = groupTimedPhotoEvents(
      events,
      (event) => event.cursor.movingElapsedMs / track.movingDurationMs,
      120_000,
    );

    expect(events.every((event) => event.cursor.stopIndex === 0)).toBe(true);
    expect(groups).toHaveLength(1);
  });
});
