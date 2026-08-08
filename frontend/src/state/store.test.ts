import { beforeEach, describe, expect, it } from "vitest";

import { migratePersistedAnimationState, useStore } from "./store";

describe("animation settings persistence", () => {
  beforeEach(() => {
    useStore.setState({
      animationDurationSec: 20,
      animationPlaybackMode: "recorded",
      skipDetectedStops: true,
      showTimedPhotos: true,
    });
  });

  it("stores target route duration and playback mode in the shared store", () => {
    useStore.getState().setAnimationDurationSec(120);
    useStore.getState().setAnimationPlaybackMode("distance");
    useStore.getState().setSkipDetectedStops(false);
    useStore.getState().setShowTimedPhotos(false);

    expect(useStore.getState().animationDurationSec).toBe(120);
    expect(useStore.getState().animationPlaybackMode).toBe("distance");
    expect(useStore.getState().skipDetectedStops).toBe(false);
    expect(useStore.getState().showTimedPhotos).toBe(false);
  });

  it("migrates points-per-second preferences to the target-duration default", () => {
    const migrated = migratePersistedAnimationState({
      animationSpeed: 500,
      animationPlaybackMode: "indexed",
    });

    expect(migrated.animationDurationSec).toBe(20);
    expect(migrated.animationPlaybackMode).toBe("indexed");
    expect(migrated.skipDetectedStops).toBe(true);
    expect(migrated.showTimedPhotos).toBe(true);
    expect(migrated).not.toHaveProperty("animationSpeed");
  });

  it("replaces incompatible persisted animation preferences", () => {
    const migrated = migratePersistedAnimationState({
      animationDurationSec: 45,
      animationPlaybackMode: "unsupported",
    });

    expect(migrated).toMatchObject({
      animationDurationSec: 20,
      animationPlaybackMode: "recorded",
    });
  });

  it("preserves valid stop and timed-photo preferences during migration", () => {
    const migrated = migratePersistedAnimationState({
      skipDetectedStops: false,
      showTimedPhotos: false,
    });

    expect(migrated.skipDetectedStops).toBe(false);
    expect(migrated.showTimedPhotos).toBe(false);
  });
});
