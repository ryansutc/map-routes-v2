import { describe, expect, it } from "vitest";
import { buildRouteTrack, type TimedTrack } from "./timedTrack";
import { planTimedPhotoEvents } from "./timedPhotoEvents";

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
