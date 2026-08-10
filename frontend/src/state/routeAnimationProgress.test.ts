import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeAnimationProgress } from "./routeAnimationProgress";
import { useStore } from "./store";

describe("routeAnimationProgress", () => {
  beforeEach(() => routeAnimationProgress.reset());

  it("publishes frame progress without updating the persisted application store", () => {
    const progressListener = vi.fn();
    const applicationStoreListener = vi.fn();
    const unsubscribeProgress = routeAnimationProgress.subscribe(progressListener);
    const unsubscribeApplicationStore = useStore.subscribe(applicationStoreListener);

    routeAnimationProgress.publish(0.375);

    expect(routeAnimationProgress.getSnapshot()).toBe(0.375);
    expect(progressListener).toHaveBeenCalledOnce();
    expect(applicationStoreListener).not.toHaveBeenCalled();

    unsubscribeProgress();
    unsubscribeApplicationStore();
  });

  it("resets progress so a cursor cannot survive navigation", () => {
    routeAnimationProgress.publish(0.75);

    routeAnimationProgress.reset();

    expect(routeAnimationProgress.getSnapshot()).toBe(0);
  });
});
