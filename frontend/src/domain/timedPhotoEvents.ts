import {
  parseAbsoluteTimestamp,
  type RouteTrack,
  type TimedTrack,
  type TrackCursor,
} from "./timedTrack";

export type TimedPhotoInput = {
  id: number;
  takenAt: string | null | undefined;
};

export type TimedPhotoEvent = {
  photoId: number;
  takenAtMs: number;
  cursor: TrackCursor;
};

export type TimedPhotoExclusionReason =
  | "legacy-route"
  | "missing-or-unresolved-time"
  | "before-route"
  | "after-route"
  | "unknown-gap";

export type TimedPhotoEligibility =
  | {
      status: "eligible";
      photoId: number;
      event: TimedPhotoEvent;
    }
  | {
      status: "excluded";
      photoId: number;
      reason: TimedPhotoExclusionReason;
    };

export const TIMED_PHOTO_GROUP_WINDOW_MS = 2_000;

export type TimedPhotoEventGroup = {
  events: readonly TimedPhotoEvent[];
  photoIds: readonly number[];
};

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
 * Classifies every photo through the same eligibility rules used by playback.
 * Results preserve input order so owner-facing callers can index or render them.
 */
export function classifyTimedPhotoEligibility(
  track: RouteTrack,
  photos: readonly TimedPhotoInput[],
): readonly TimedPhotoEligibility[] {
  return photos.map((photo) => {
    if (track.kind === "legacy") {
      return {
        status: "excluded",
        photoId: photo.id,
        reason: "legacy-route",
      };
    }

    const takenAtMs = parseAbsoluteTimestamp(photo.takenAt);
    if (takenAtMs === null) {
      return {
        status: "excluded",
        photoId: photo.id,
        reason: "missing-or-unresolved-time",
      };
    }
    if (takenAtMs < track.startedAtMs) {
      return {
        status: "excluded",
        photoId: photo.id,
        reason: "before-route",
      };
    }
    if (takenAtMs > track.endedAtMs) {
      return {
        status: "excluded",
        photoId: photo.id,
        reason: "after-route",
      };
    }
    if (isStrictlyInsideGap(track, takenAtMs)) {
      return {
        status: "excluded",
        photoId: photo.id,
        reason: "unknown-gap",
      };
    }

    return {
      status: "eligible",
      photoId: photo.id,
      event: {
        photoId: photo.id,
        takenAtMs,
        cursor: track.atTimestamp(takenAtMs),
      },
    };
  });
}

/**
 * Maps trustworthy photo timestamps to exact track cursors once per route.
 * Callers schedule the resulting sorted list with a forward event cursor.
 */
export function planTimedPhotoEvents(
  track: TimedTrack,
  photos: readonly TimedPhotoInput[],
): readonly TimedPhotoEvent[] {
  const events = classifyTimedPhotoEligibility(track, photos).flatMap(
    (result) => (result.status === "eligible" ? [result.event] : []),
  );

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
