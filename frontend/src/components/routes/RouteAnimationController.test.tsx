// @vitest-environment jsdom

import { buildRouteTrack } from "@/domain/timedTrack";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteAnimationController } from "./RouteAnimationController";

const mocks = vi.hoisted(() => ({
  state: "idle" as "idle" | "playing" | "paused" | "completed",
  play: vi.fn(),
  stop: vi.fn(),
  showOverview: vi.fn(),
  showStartOverview: vi.fn(),
}));

vi.mock("@/hooks/useRouteAnimation", () => ({
  useRouteAnimation: () => ({
    state: mocks.state,
    playbackProgress: mocks.state === "completed" ? 1 : 0.5,
    pointCount: 2,
    play: mocks.play,
    stop: mocks.stop,
    acquirePause: vi.fn(() => vi.fn()),
    photoPlaybackEngine: {},
  }),
}));

vi.mock("@/components/map/routeCompletionCamera", () => ({
  showCompletedRouteOverview: (...args: unknown[]) => mocks.showOverview(...args),
  showRouteStartOverview: (...args: unknown[]) => mocks.showStartOverview(...args),
}));

vi.mock("@/components/settings/SettingsDialog", () => ({
  useSettingsDialog: () => ({
    registerRouteContext: vi.fn(() => vi.fn()),
  }),
}));

vi.mock("./RouteAnimationControls", () => ({
  RouteAnimationControls: ({
    onPlay,
    completionPresentationActive,
    replayButtonRef,
  }: {
    onPlay: () => void;
    completionPresentationActive: boolean;
    replayButtonRef: RefObject<HTMLButtonElement>;
  }) => (
    <button
      ref={replayButtonRef}
      onClick={onPlay}
      disabled={completionPresentationActive}
    >
      Replay route
    </button>
  ),
}));

const track = buildRouteTrack({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
      properties: {},
    },
  ],
});

const baseProps: ComponentProps<typeof RouteAnimationController> = {
  getMap: () => ({} as never),
  getView: () => ({ type: "2d" } as never),
  track,
  photos: [],
  timedPhotoPresenter: { open: vi.fn(), close: vi.fn(), preload: vi.fn() },
  photoMapAnchor: null,
  onSessionActiveChange: vi.fn(),
  routeTitle: "Forest route",
  distance: 5_000,
  elevationGain: "300",
  duration: 3_600,
};

describe("RouteAnimationController completion presentation", () => {
  beforeEach(() => {
    mocks.state = "idle";
    mocks.play.mockReset();
    mocks.stop.mockReset();
    mocks.showOverview.mockReset().mockResolvedValue(undefined);
    mocks.showStartOverview.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("runs only after natural completion, locks through dismissal, restores focus, and can replay", async () => {
    const onSessionActiveChange = vi.fn();
    const { rerender } = render(
      <RouteAnimationController
        {...baseProps}
        onSessionActiveChange={onSessionActiveChange}
      />,
    );

    mocks.state = "playing";
    rerender(
      <RouteAnimationController
        {...baseProps}
        onSessionActiveChange={onSessionActiveChange}
      />,
    );
    mocks.state = "completed";
    rerender(
      <RouteAnimationController
        {...baseProps}
        onSessionActiveChange={onSessionActiveChange}
      />,
    );

    expect(
      (screen.getByRole("button", {
        name: "Replay route",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mocks.showOverview).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("dialog", { name: /Route complete/ }),
    ).toBeTruthy();
    expect(onSessionActiveChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Close route summary" }));
    await waitFor(() => {
      expect(onSessionActiveChange).toHaveBeenLastCalledWith(false);
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Replay route" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(mocks.showStartOverview).toHaveBeenCalledWith(
      baseProps.getView(),
      track,
      false,
    );
    expect(
      await screen.findByRole("dialog", { name: /Route complete/ }),
    ).toBeTruthy();
    expect(mocks.showOverview).toHaveBeenCalledTimes(2);
  });

  it("waits for the route extent before starting playback", async () => {
    let finishCameraMove: () => void = () => undefined;
    mocks.showStartOverview.mockReturnValue(
      new Promise<void>((resolve) => {
        finishCameraMove = resolve;
      }),
    );
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    expect(mocks.showStartOverview).toHaveBeenCalledOnce();
    expect(mocks.play).not.toHaveBeenCalled();

    finishCameraMove();
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
  });

  it("starts playback when the route extent navigation fails", async () => {
    mocks.showStartOverview.mockRejectedValue(new Error("navigation cancelled"));
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
  });

  it("does not present completion after Stop returns the session to idle", () => {
    const { rerender } = render(<RouteAnimationController {...baseProps} />);
    mocks.state = "playing";
    rerender(<RouteAnimationController {...baseProps} />);
    mocks.state = "idle";
    rerender(<RouteAnimationController {...baseProps} />);

    expect(mocks.showOverview).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /Route complete/ })).toBeNull();
  });

  it("still opens the summary and unlocks when camera navigation fails", async () => {
    const onSessionActiveChange = vi.fn();
    mocks.showOverview.mockRejectedValue(new Error("view destroyed"));
    const { rerender } = render(
      <RouteAnimationController
        {...baseProps}
        onSessionActiveChange={onSessionActiveChange}
      />,
    );
    mocks.state = "completed";
    rerender(
      <RouteAnimationController
        {...baseProps}
        onSessionActiveChange={onSessionActiveChange}
      />,
    );

    expect(
      await screen.findByRole("dialog", { name: /Route complete/ }),
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(onSessionActiveChange).toHaveBeenLastCalledWith(false),
    );
  });
});
