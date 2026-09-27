// @vitest-environment jsdom

import { RouteAnimationControls } from "@/components/routes/RouteAnimationControls";
import { useStore } from "@/state/store";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettingsDialogProvider,
  type RouteSettingsContext,
  useSettingsDialog,
} from "./SettingsDialog";

function setMobileViewport(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: mobile,
      media: "(max-width:599.95px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function RouteRegistration({ context }: { context: RouteSettingsContext }) {
  const { registerRouteContext } = useSettingsDialog();
  useEffect(() => registerRouteContext(context), [context, registerRouteContext]);
  return null;
}

function PlaybackEntry({ context }: { context?: RouteSettingsContext }) {
  return (
    <SettingsDialogProvider>
      {context && <RouteRegistration context={context} />}
      <RouteAnimationControls
        state="idle"
        playbackProgress={0}
        pointCount={3}
        targetDurationSec={20}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />
    </SettingsDialogProvider>
  );
}

describe("SettingsDialog", () => {
  beforeEach(() => {
    setMobileViewport(false);
    localStorage.clear();
    useStore.setState({
      units: "metric",
      animationDurationSec: 20,
      animationPlaybackMode: "recorded",
      skipDetectedStops: true,
      showTimedPhotos: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens from playback at Map Animation without animating the scroll", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<PlaybackEntry />);
    fireEvent.click(screen.getByRole("button", { name: "Playback settings" }));

    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Map Animation" })).toBeTruthy();
    expect(screen.getByLabelText("Target route duration")).toBeTruthy();
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      }),
    );
  });

  it("smoothly navigates to a section and briefly highlights it", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<PlaybackEntry />);
    fireEvent.click(screen.getByRole("button", { name: "Playback settings" }));
    await screen.findByRole("dialog", { name: "Settings" });
    scrollIntoView.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "General" }));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    await waitFor(() =>
      expect(
        document.querySelector("#settings-general")?.getAttribute(
          "data-highlighted",
        ),
      ).toBe("true"),
    );
  });

  it("keeps unsupported route preferences enabled and explains the fallback", async () => {
    const releasePause = vi.fn();
    const acquirePause: RouteSettingsContext["acquirePause"] = vi.fn(
      () => releasePause,
    );
    const context: RouteSettingsContext = {
      availablePlaybackModes: ["indexed", "distance"],
      effectivePlaybackMode: "indexed",
      timestampCapable: false,
      acquirePause,
    };
    render(<PlaybackEntry context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Playback settings" }));

    expect(
      await screen.findByText(
        "Not supported by the current route. Playback uses “By GPS points”.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("switch", {
        name: "Skip detected stops",
      }) as HTMLInputElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("switch", {
        name: "Show timed photos",
      }) as HTMLInputElement).disabled,
    ).toBe(false);
    expect(acquirePause).toHaveBeenCalledWith("settings-dialog");

    fireEvent.click(
      screen.getByRole("switch", { name: "Skip detected stops" }),
    );
    expect(useStore.getState().skipDetectedStops).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    await waitFor(() => expect(releasePause).toHaveBeenCalledOnce());
  });

  it("disables animation settings during completion presentation", async () => {
    const context: RouteSettingsContext = {
      availablePlaybackModes: ["recorded", "distance"],
      effectivePlaybackMode: "recorded",
      timestampCapable: true,
      animationSettingsDisabled: true,
      acquirePause: vi.fn(() => vi.fn()),
    };
    render(<PlaybackEntry context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Playback settings" }));

    expect(
      await screen.findByText(
        "Animation settings are unavailable while route completion is being presented.",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByLabelText("Target route duration")
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      (screen.getByRole("switch", {
        name: "Show timed photos",
      }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("uses a full-screen combined view and scrolls to animation on mobile", async () => {
    setMobileViewport(true);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<PlaybackEntry />);
    fireEvent.click(screen.getByRole("button", { name: "Playback settings" }));

    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(dialog.classList.contains("MuiDialog-paperFullScreen")).toBe(true);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("heading", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Map Animation" })).toBeTruthy();
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      }),
    );
  });
});
