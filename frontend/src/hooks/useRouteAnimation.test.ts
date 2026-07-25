import { describe, expect, it } from "vitest";
import { shouldUpdateProgress } from "./useRouteAnimationUtils";

describe("shouldUpdateProgress", () => {
  it("does not emit a new progress update when the interval has not elapsed and the change is small", () => {
    expect(
      shouldUpdateProgress({
        now: 150,
        lastUpdateTime: 100,
        lastProgress: 0.1,
        nextProgress: 0.12,
        intervalMs: 100,
        threshold: 0.05,
      }),
    ).toBe(false);
  });

  it("emits a new progress update when enough time has elapsed", () => {
    expect(
      shouldUpdateProgress({
        now: 250,
        lastUpdateTime: 100,
        lastProgress: 0.1,
        nextProgress: 0.12,
        intervalMs: 100,
        threshold: 0.05,
      }),
    ).toBe(true);
  });

  it("emits a new progress update when the progress delta is large enough", () => {
    expect(
      shouldUpdateProgress({
        now: 120,
        lastUpdateTime: 100,
        lastProgress: 0.1,
        nextProgress: 0.2,
        intervalMs: 100,
        threshold: 0.05,
      }),
    ).toBe(true);
  });
});
