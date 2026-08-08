import type { TimedTrack, TrackCursor } from "./timedTrack";

export type TimedPhotoInput = {
  id: number;
  takenAt: string | null | undefined;
};

export type TimedPhotoEvent = {
  photoId: number;
  takenAtMs: number;
  cursor: TrackCursor;
};

export const TIMED_PHOTO_GROUP_WINDOW_MS = 2_000;

export type TimedPhotoEventGroup = {
  events: readonly TimedPhotoEvent[];
  photoIds: readonly number[];
};

const ABSOLUTE_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

function parseAbsoluteTimestamp(value: string | null | undefined) {
  if (!value || !ABSOLUTE_TIMESTAMP_PATTERN.test(value)) return null;
  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function isStrictlyInsideGap(track: TimedTrack, timestampMs: number) {
  let low = 0;
  let high = track.gaps.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.gaps[middle]!.startTimestampMs < timestampMs) low = middle + 1;
    else high = middle;
  }
  const gap = track.gaps[low - 1];
  return !!gap && timestampMs < gap.endTimestampMs;
}

/**
 * Maps trustworthy photo timestamps to exact track cursors once per route.
 * Callers schedule the resulting sorted list with a forward event cursor.
 */
export function planTimedPhotoEvents(
  track: TimedTrack,
  photos: readonly TimedPhotoInput[],
): readonly TimedPhotoEvent[] {
  const events: TimedPhotoEvent[] = [];

  for (const photo of photos) {
    const takenAtMs = parseAbsoluteTimestamp(photo.takenAt);
    if (
      takenAtMs === null ||
      takenAtMs < track.startedAtMs ||
      takenAtMs > track.endedAtMs ||
      isStrictlyInsideGap(track, takenAtMs)
    ) {
      continue;
    }
    events.push({
      photoId: photo.id,
      takenAtMs,
      cursor: track.atTimestamp(takenAtMs),
    });
  }

  events.sort(
    (first, second) =>
      first.takenAtMs - second.takenAtMs || first.photoId - second.photoId,
  );
  return events;
}

/** Groups an already sorted event list using its selected playback projection. */
export function groupTimedPhotoEvents(
  events: readonly TimedPhotoEvent[],
  playbackProgressAt: (event: TimedPhotoEvent) => number,
  targetRouteDurationMs: number,
): readonly TimedPhotoEventGroup[] {
  const groups: TimedPhotoEvent[][] = [];

  for (const event of events) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    const sameTimestamp = previous?.takenAtMs === event.takenAtMs;
    const sameCollapsedStop =
      previous?.cursor.stopIndex !== null &&
      previous?.cursor.stopIndex === event.cursor.stopIndex &&
      playbackProgressAt(previous) === playbackProgressAt(event);
    const playbackSeparationMs = previous
      ? Math.max(
          0,
          (playbackProgressAt(event) - playbackProgressAt(previous)) *
            targetRouteDurationMs,
        )
      : Number.POSITIVE_INFINITY;

    if (
      current &&
      (sameTimestamp ||
        sameCollapsedStop ||
        playbackSeparationMs <= TIMED_PHOTO_GROUP_WINDOW_MS)
    ) {
      current.push(event);
    } else {
      groups.push([event]);
    }
  }

  return groups.map((group) => ({
    events: group,
    photoIds: group.map((event) => event.photoId),
  }));
}
