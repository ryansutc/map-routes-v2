// @vitest-environment jsdom

import { buildRouteTrack } from "@/domain/timedTrack";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteAnimationController } from "./RouteAnimationController";
import { useStore } from "@/state/store";

const mocks = vi.hoisted(() => ({
  state: "idle" as "idle" | "playing" | "paused" | "completed",
  play: vi.fn(),
  stop: vi.fn(),
  showOverview: vi.fn(),
  showStartOverview: vi.fn(),
  centerRoutePosition: vi.fn(),
  captureFollowZoom: vi.fn(() => 9),
  frameListener: null as null | ((snapshot: never) => void),
  engine: { getSnapshot: vi.fn(), getPositionAfter: vi.fn() },
  updateFollow: vi.fn(),
  toggleFollow: vi.fn(),
  cancelFollow: vi.fn(),
  setFollowZoom: vi.fn(),
  subscribeToFrames: vi.fn(),
}));

vi.mock("@/hooks/useRouteAnimation", () => ({
  useRouteAnimation: () => ({
    state: mocks.state,
    playbackProgress: mocks.state === "completed" ? 1 : 0.5,
    pointCount: 2,
    play: mocks.play,
    stop: mocks.stop,
    acquirePause: vi.fn(() => vi.fn()),
    photoPlaybackEngine: mocks.engine,
    position: {
      coordinate: [0, 0],
      pointIndex: 0,
      originalElapsedMs: null,
      cumulativeDistanceM: 0,
    },
    subscribeToFrames: mocks.subscribeToFrames,
  }),
}));

vi.mock("@/components/map/routeFollowCamera", () => ({
  captureFollowZoom: () => mocks.captureFollowZoom(),
  createRouteFollowCamera: (view: unknown) => {
    let zoom: number | null = null;
    return {
      setEnabled: mocks.toggleFollow,
      setZoom: (nextZoom: number) => {
        zoom = nextZoom;
        mocks.setFollowZoom(nextZoom);
      },
      update: mocks.updateFollow,
      cancel: mocks.cancelFollow,
      centerStart: (position: unknown, animate: boolean) =>
        mocks.centerRoutePosition(view, position, zoom, animate),
    };
  },
}));

vi.mock("@/components/map/routeCompletionCamera", () => ({
  showCompletedRouteOverview: (...args: unknown[]) =>
    mocks.showOverview(...args),
  showRouteStartOverview: (...args: unknown[]) =>
    mocks.showStartOverview(...args),
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
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    },
  ],
});

const baseProps: ComponentProps<typeof RouteAnimationController> = {
  getMap: () => ({}) as never,
  getView: () => ({ type: "2d" }) as never,
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
    mocks.centerRoutePosition.mockReset().mockResolvedValue(undefined);
    mocks.captureFollowZoom.mockClear();
    mocks.frameListener = null;
    mocks.updateFollow.mockClear();
    mocks.toggleFollow.mockClear();
    mocks.cancelFollow.mockClear();
    mocks.setFollowZoom.mockClear();
    mocks.engine.getSnapshot.mockImplementation(() => ({ state: mocks.state }));
    mocks.subscribeToFrames.mockImplementation((listener) => {
      mocks.frameListener = listener;
      return () => {
        mocks.frameListener = null;
      };
    });
    useStore.setState({ followAlong: false });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
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
      (
        screen.getByRole("button", {
          name: "Replay route",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.showOverview).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("dialog", { name: /Route complete/ }),
    ).toBeTruthy();
    expect(onSessionActiveChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Close route summary" }),
    );
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
    mocks.showStartOverview.mockRejectedValue(
      new Error("navigation cancelled"),
    );
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
  });

  it("waits for the initial followed position before playback", async () => {
    let finishFollowMove: () => void = () => undefined;
    mocks.centerRoutePosition.mockReturnValue(
      new Promise<void>((resolve) => {
        finishFollowMove = resolve;
      }),
    );
    useStore.setState({ followAlong: true });
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    await waitFor(() => expect(mocks.centerRoutePosition).toHaveBeenCalled());
    expect(mocks.play).not.toHaveBeenCalled();
    finishFollowMove();
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
  });

  it("uses an instantaneous initial follow for reduced motion", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    useStore.setState({ followAlong: true });
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(mocks.centerRoutePosition).toHaveBeenCalledWith(
      baseProps.getView(),
      expect.objectContaining({ coordinate: [0, 0, 0] }),
      9,
      false,
    );
  });

  it("starts playback when the initial followed navigation fails", async () => {
    useStore.setState({ followAlong: true });
    mocks.centerRoutePosition.mockRejectedValue(new Error("view unavailable"));
    render(<RouteAnimationController {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));

    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
  });

  it("forwards playback frames directly to the follow adapter", () => {
    render(<RouteAnimationController {...baseProps} />);
    const snapshot = {
      state: "playing",
      position: { coordinate: [1, 2] },
      positionRevision: 3,
    };
    mocks.frameListener?.(snapshot as never);
    expect(mocks.updateFollow).toHaveBeenLastCalledWith(snapshot);
  });

  it("updates the preference without recapturing session zoom and cancels on unmount", async () => {
    const { unmount } = render(<RouteAnimationController {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Replay route" }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(mocks.setFollowZoom).toHaveBeenCalledExactlyOnceWith(9);
    await act(async () => useStore.getState().setFollowAlong(true));
    expect(mocks.toggleFollow).toHaveBeenLastCalledWith(true);
    await act(async () => useStore.getState().setFollowAlong(false));
    expect(mocks.toggleFollow).toHaveBeenLastCalledWith(false);
    expect(mocks.captureFollowZoom).toHaveBeenCalledOnce();
    mocks.cancelFollow.mockClear();
    unmount();
    expect(mocks.cancelFollow).toHaveBeenCalledOnce();
    expect(mocks.frameListener).toBeNull();
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
