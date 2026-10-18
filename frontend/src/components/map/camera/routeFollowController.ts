/** Provider-independent viewport and scheduling logic for the follow camera. */
import {
  isAnimationSessionActive,
  type AnimationPosition,
  type RouteAnimationSnapshot,
} from "@/domain/routeAnimation";

export const FOLLOW_CHECK_INTERVAL_MS = 100;
export const FOLLOW_LOOK_AHEAD_BUFFER_MS = 500;
const PATH_SAMPLES = 8;

export type ScreenPoint = { x: number; y: number };
export type FollowViewport = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: ScreenPoint;
};

type FollowAdapter = {
  project: (position: AnimationPosition) => ScreenPoint | null;
  viewport: () => FollowViewport | null;
  move: (
    position: AnimationPosition,
    options: { animate: boolean; duration: number; signal: AbortSignal },
  ) => Promise<void>;
};

/**
 * Returns true when a projected route point lies within the viewport’s
 *  safe inset, so the follow controller can tell  whether the current
 * route position is still comfortably visible and not too close to
 * the edges.
 *
 * @param point
 * @param viewport
 * @param inset
 * @returns
 */
function inside(
  point: ScreenPoint | null,
  viewport: FollowViewport,
  inset: number,
) {
  if (!point) return false;
  const dx = (viewport.right - viewport.left) * inset;
  const dy = (viewport.bottom - viewport.top) * inset;
  return (
    point.x >= viewport.left + dx &&
    point.x <= viewport.right - dx &&
    point.y >= viewport.top + dy &&
    point.y <= viewport.bottom - dy
  );
}

/** Visibility policy and navigation lifecycle; no map-library or React dependencies. */
export function createRouteFollowController(
  adapter: FollowAdapter,
  options: {
    getPositionAfter: (milliseconds: number) => AnimationPosition | null;
    reducedMotion: () => boolean;
    duration: number;
  },
) {
  let enabled = false;
  let destroyed = false;
  let latest: RouteAnimationSnapshot | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: { abort: AbortController; recovery: boolean } | null = null;

  const cancelMove = () => {
    const previous = pending;
    pending = null;
    previous?.abort.abort();
  };
  const cancel = () => {
    clearInterval(timer);
    timer = undefined;
    cancelMove();
  };
  const move = async (
    position: AnimationPosition,
    animate: boolean,
    recovery = false,
  ) => {
    const operation = { abort: new AbortController(), recovery };
    pending = operation;
    try {
      await adapter.move(position, {
        animate,
        duration: options.duration,
        signal: operation.abort.signal,
      });
    } catch {
      // A later visibility check retries failures without affecting playback.
    } finally {
      if (pending === operation) pending = null;
    }
  };
  const check = () => {
    const current = latest?.position;
    if (
      !enabled ||
      destroyed ||
      !latest ||
      !current ||
      !isAnimationSessionActive(latest.state)
    )
      return;
    try {
      const screen = adapter.project(current);
      const viewport = adapter.viewport();
      if (!viewport) return;
      const emergency = !inside(screen, viewport, 0.05);
      if (pending) {
        // Emergency recovery is instantaneous and gets to finish, including
        // asynchronous terrain preparation. Repeated aborts would starve it.
        if (!emergency || pending.recovery) return;
        cancelMove();
      }
      if (emergency) {
        void move(current, false, true);
        return;
      }
      const future = options.getPositionAfter(options.duration);
      if (
        inside(screen, viewport, 0.2) &&
        future &&
        inside(adapter.project(future), viewport, 0.2)
      )
        return;

      // Project a short prefix of the real route, rather than extrapolating a
      // bearing. Stop look-ahead when a turn would put the prefix outside the
      // destination's safe area. Translation is an estimate in tilted 3D;
      // ongoing checks use the actual camera projection throughout the move.
      let target = current;
      const prefix: ScreenPoint[] = screen ? [screen] : [];
      const horizon = options.duration + FOLLOW_LOOK_AHEAD_BUFFER_MS;
      for (let index = 1; index <= PATH_SAMPLES; index++) {
        const candidate = options.getPositionAfter(
          (horizon * index) / PATH_SAMPLES,
        );
        if (!candidate) break;
        const projected = adapter.project(candidate);
        if (!projected) break;
        const shift = {
          x: projected.x - viewport.center.x,
          y: projected.y - viewport.center.y,
        };
        prefix.push(projected);
        if (
          !prefix.every((point) =>
            inside(
              { x: point.x - shift.x, y: point.y - shift.y },
              viewport,
              0.2,
            ),
          )
        )
          break;
        target = candidate;
      }
      void move(target, !options.reducedMotion());
    } catch {
      // Unready/destroying views and temporary projection failures are retried.
    }
  };
  const update = (snapshot: RouteAnimationSnapshot) => {
    const previous = latest;
    latest = snapshot;
    if (
      destroyed ||
      !enabled ||
      !isAnimationSessionActive(snapshot.state) ||
      snapshot.activePauseReasons.includes("document-hidden")
    ) {
      cancel();
      return;
    }
    const relocated =
      previous && previous.positionRevision !== snapshot.positionRevision;
    if (relocated) cancelMove();
    if (timer === undefined) {
      timer = setInterval(check, FOLLOW_CHECK_INTERVAL_MS);
      check();
    } else if (relocated) {
      check();
    }
  };

  return {
    update,
    setEnabled(value: boolean) {
      if (enabled === value || destroyed) return;
      enabled = value;
      if (!value) cancel();
      else if (latest) {
        // Enabling mid-session centers immediately before predictive following.
        if (latest.position && isAnimationSessionActive(latest.state))
          void move(latest.position, false, true);
        update(latest);
      }
    },
    async centerStart(position: AnimationPosition, animate: boolean) {
      cancelMove();
      if (enabled && !destroyed) await move(position, animate);
    },
    cancel,
    destroy() {
      destroyed = true;
      cancel();
    },
  };
}
