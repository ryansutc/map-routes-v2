import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnimationPosition,
  RouteAnimationSnapshot,
} from "@/domain/routeAnimation";
import { createRouteFollowController } from "./routeFollowController";

const position = (x: number, y = 500): AnimationPosition => ({
  coordinate: [x, y],
  pointIndex: 0,
  cumulativeDistanceM: x,
  originalElapsedMs: 0,
});
const frame = (
  x: number,
  extra: Partial<RouteAnimationSnapshot> = {},
): RouteAnimationSnapshot => ({
  state: "playing",
  position: position(x),
  playbackProgress: 0.2,
  distanceProgress: 0.2,
  playbackMode: "distance",
  skipDetectedStops: false,
  activePauseReasons: [],
  positionRevision: 0,
  ...extra,
});

function harness() {
  let currentX = 500;
  let futureX = 500;
  let centerX = 500;
  const project = vi.fn((p: AnimationPosition) => ({
    x: p.coordinate[0] - centerX + 500,
    y: p.coordinate[1],
  }));
  const move = vi.fn(
    async (
      p: AnimationPosition,
      _options: { animate: boolean; duration: number; signal: AbortSignal },
    ) => {
      void _options;
      centerX = p.coordinate[0];
    },
  );
  const getPositionAfter = vi.fn((_ms: number) => {
    void _ms;
    return position(futureX);
  });
  const reducedMotion = vi.fn(() => false);
  const camera = createRouteFollowController(
    {
      project,
      viewport: () => ({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 1000,
        center: { x: 500, y: 500 },
      }),
      move,
    },
    { getPositionAfter, reducedMotion, duration: 1300 },
  );
  camera.setEnabled(true);
  return {
    camera,
    project,
    move,
    getPositionAfter,
    reducedMotion,
    future(x: number) {
      futureX = x;
    },
    update(x = currentX, extra: Partial<RouteAnimationSnapshot> = {}) {
      currentX = x;
      camera.update(frame(x, extra));
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("visibility-driven route camera", () => {
  it("keeps the camera still inside the safe area and checks by time, not frame count", async () => {
    const h = harness();
    h.update();
    h.project.mockClear();
    for (let i = 0; i < 1000; i++) h.update(500 + i / 1000);
    expect(h.project).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(h.project).toHaveBeenCalled();
    expect(h.move).not.toHaveBeenCalled();
  });

  it.each([
    position(190),
    position(810),
    position(500, 190),
    position(500, 810),
  ])("moves when approaching any edge: %o", async (current) => {
    const h = harness();
    h.getPositionAfter.mockReturnValue(current);
    h.update(current.coordinate[0], { position: current });
    expect(h.move).toHaveBeenCalledExactlyOnceWith(
      current,
      expect.objectContaining({ animate: true, duration: 1300 }),
    );
    h.camera.destroy();
  });

  it("starts before reaching the edge and targets the real future path", () => {
    const h = harness();
    h.getPositionAfter.mockImplementation((ms = 0) => position(500 + ms / 4));
    h.update();
    expect(h.move).toHaveBeenCalledWith(
      position(781.25),
      expect.objectContaining({ animate: true }),
    );
    // A further target would push the current marker outside the safe area;
    // the bounded target leaves the entire sampled prefix inside it.
    expect(h.getPositionAfter).toHaveBeenCalledWith(1350);
  });

  it("does not aim past a sharp turn whose intermediate path would be clipped", () => {
    const h = harness();
    h.getPositionAfter.mockImplementation((ms = 0) =>
      ms < 1000 ? position(1000, 500) : position(500, 500),
    );
    h.update(190);
    expect(h.move).toHaveBeenCalledWith(position(190), expect.anything());
  });

  it("lets ordinary navigation finish while playback positions keep advancing", async () => {
    const h = harness();
    let finish!: () => void;
    h.move.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    h.future(810);
    h.update(790);
    const options = h.move.mock.calls[0]?.[1];
    h.update(800);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.move).toHaveBeenCalledOnce();
    expect(options?.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    finish();
    await vi.advanceTimersByTimeAsync(100);
    expect(h.move).toHaveBeenCalledTimes(2);
  });

  it("interrupts once for an edge emergency without starving recovery preparation", async () => {
    const h = harness();
    h.move.mockImplementation(() => new Promise<void>(() => {}));
    h.future(810);
    h.update(790);
    const original = h.move.mock.calls[0]?.[1];
    h.update(990);
    await vi.advanceTimersByTimeAsync(100);
    expect(original?.signal.aborted).toBe(true);
    expect(h.move).toHaveBeenLastCalledWith(
      position(990),
      expect.objectContaining({ animate: false }),
    );
    const recovery = h.move.mock.calls[1]?.[1];
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.move).toHaveBeenCalledTimes(2);
    expect(recovery?.signal.aborted).toBe(false);
    h.camera.destroy();
  });

  it("immediately reassesses a paused photo relocation instead of waiting for the interval", () => {
    const h = harness();
    h.update();
    h.getPositionAfter.mockReturnValue(position(990));
    h.update(990, {
      state: "paused",
      positionRevision: 1,
      activePauseReasons: ["photo"],
    });
    expect(h.move).toHaveBeenCalledWith(
      position(990),
      expect.objectContaining({ animate: false }),
    );
  });

  it.each(["off", "idle", "completed", "hidden", "destroy"])(
    "cancels pending preparation and stops checks on %s",
    async (reason) => {
      const h = harness();
      h.move.mockImplementation(() => new Promise<void>(() => {}));
      h.future(810);
      h.update(790);
      const operation = h.move.mock.calls[0]?.[1];
      if (reason === "off") h.camera.setEnabled(false);
      else if (reason === "destroy") h.camera.destroy();
      else if (reason === "hidden")
        h.update(790, { activePauseReasons: ["document-hidden"] });
      else h.update(790, { state: reason as "idle" | "completed" });
      expect(operation?.signal.aborted).toBe(true);
      h.project.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.project).not.toHaveBeenCalled();
    },
  );

  it("uses instantaneous moves for reduced motion and retries rejected navigation", async () => {
    const h = harness();
    h.reducedMotion.mockReturnValue(true);
    h.move.mockRejectedValueOnce(new Error("view unavailable"));
    h.future(810);
    h.update(790);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.move).toHaveBeenCalledTimes(2);
    expect(h.move).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ animate: false }),
    );
  });

  it("re-enabling centers the latest position without resetting playback", async () => {
    const h = harness();
    h.update();
    h.camera.setEnabled(false);
    h.update(600);
    h.camera.setEnabled(true);
    expect(h.move).toHaveBeenCalledExactlyOnceWith(
      position(600),
      expect.objectContaining({ animate: false }),
    );
    await vi.advanceTimersByTimeAsync(500);
  });
});
