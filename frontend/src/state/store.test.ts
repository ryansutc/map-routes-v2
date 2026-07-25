import { beforeEach, describe, expect, it } from "vitest";

import { useStore } from "./store";

describe("animation settings persistence", () => {
  beforeEach(() => {
    useStore.setState({
      animationSpeed: 50,
      animationPlaybackMode: "indexed",
    });
  });

  it("stores animation speed and playback mode in the shared store", () => {
    useStore.getState().setAnimationSpeed(120);
    useStore.getState().setAnimationPlaybackMode("distance");

    expect(useStore.getState().animationSpeed).toBe(120);
    expect(useStore.getState().animationPlaybackMode).toBe("distance");
  });
});
