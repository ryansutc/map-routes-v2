// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutomaticPhotoPresentation, PhotoSessionId } from "@/domain/timedPhotoPlayback";
import type { PhotoMapAnchor } from "@/domain/photoMapAnchor";
import { AutomaticPhotoPopup } from "./AutomaticPhotoPopup";

afterEach(cleanup);

function presentation(): AutomaticPhotoPresentation {
  return {
    kind: "automatic",
    sessionId: Symbol("test") as PhotoSessionId,
    photoId: 7,
    onLoad: vi.fn(),
    onError: vi.fn(),
    onDismiss: vi.fn(),
    onNavigate: vi.fn(),
    onTimerPauseChange: vi.fn(),
  };
}

function anchor(
  snapshot: ReturnType<PhotoMapAnchor["getSnapshot"]>,
): PhotoMapAnchor {
  return { getSnapshot: () => snapshot, subscribe: () => () => {} };
}

describe("AutomaticPhotoPopup", () => {
  it("opens without moving focus and uses responsive flip/clamp placement", () => {
    const before = document.createElement("button");
    document.body.appendChild(before);
    before.focus();

    const { rerender } = render(
      <AutomaticPhotoPopup
        photo={{ id: 7, url: "/photo.jpg", title: "Summit" }}
        presentation={presentation()}
        mapAnchor={anchor({
          x: 400,
          y: 300,
          viewportWidth: 800,
          viewportHeight: 600,
          visible: true,
        })}
      />,
    );

    expect(document.activeElement).toBe(before);
    expect(screen.getByRole("dialog").getAttribute("data-popup-width")).toBe("240");
    expect(screen.getByRole("dialog").getAttribute("data-placement")).toBe("above");

    rerender(
      <AutomaticPhotoPopup
        photo={{ id: 7, url: "/photo.jpg", title: "Summit" }}
        presentation={presentation()}
        mapAnchor={anchor({
          x: 5,
          y: 10,
          viewportWidth: 360,
          viewportHeight: 640,
          visible: true,
        })}
      />,
    );

    expect(screen.getByRole("dialog").getAttribute("data-popup-width")).toBe("180");
    expect(screen.getByRole("dialog").getAttribute("data-placement")).toBe("below");
    expect(screen.getByRole("dialog").style.left).toBe("8px");

    rerender(
      <AutomaticPhotoPopup
        photo={{ id: 7, url: "/photo.jpg", title: "Summit" }}
        presentation={presentation()}
        mapAnchor={anchor({
          x: 400,
          y: 580,
          viewportWidth: 800,
          viewportHeight: 600,
          visible: true,
        })}
      />,
    );
    expect(screen.getByRole("dialog").style.top).toBe("302px");
    before.remove();
  });

  it("offers keyboard close and expansion without a duplicate Stop action", () => {
    const current = presentation();
    render(
      <AutomaticPhotoPopup
        photo={{ id: 7, url: "/photo.jpg", title: "Summit" }}
        presentation={current}
        mapAnchor={anchor({
          x: 200,
          y: 200,
          viewportWidth: 800,
          viewportHeight: 600,
          visible: true,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Summit in photo viewer" }));
    expect(current.onNavigate).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(current.onDismiss).toHaveBeenCalledOnce();
  });

  it("suspends the timer while hovered or focused inside", () => {
    const current = presentation();
    render(
      <AutomaticPhotoPopup
        photo={{ id: 7, url: "/photo.jpg", title: null }}
        presentation={current}
        mapAnchor={anchor({
          x: 200,
          y: 200,
          viewportWidth: 800,
          viewportHeight: 600,
          visible: true,
        })}
      />,
    );
    const popup = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close photo popup" });

    fireEvent.mouseEnter(popup);
    close.focus();
    fireEvent.mouseLeave(popup);
    expect(current.onTimerPauseChange).toHaveBeenCalledTimes(1);
    expect(current.onTimerPauseChange).toHaveBeenLastCalledWith(true);

    close.blur();
    expect(current.onTimerPauseChange).toHaveBeenLastCalledWith(false);
  });
});
