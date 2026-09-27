// @vitest-environment jsdom

import { useStore } from "@/state/store";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteCompletionDialog } from "./RouteCompletionDialog";

describe("RouteCompletionDialog", () => {
  beforeEach(() => useStore.setState({ units: "metric" }));
  afterEach(cleanup);

  it("shows canonical route metrics and preserves legitimate zero values", () => {
    render(
      <RouteCompletionDialog
        open
        title="Alpine loop"
        distance={0}
        elevationGain="125.4"
        duration={0}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Route complete" })).toBeTruthy();
    expect(screen.getByText("Alpine loop")).toBeTruthy();
    expect(screen.getByText("0.00 km")).toBeTruthy();
    expect(screen.getByText("125 m")).toBeTruthy();
    expect(screen.getByText("0m")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close route summary" }),
    );
  });

  it("keeps all fields visible when metadata is missing and supports Escape", () => {
    const onClose = vi.fn();
    render(<RouteCompletionDialog open onClose={onClose} />);

    expect(screen.getAllByText("—")).toHaveLength(3);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("dismisses from the backdrop without passing the event through", () => {
    const onClose = vi.fn();
    const mapClick = vi.fn();
    render(
      <div onMouseDown={mapClick}>
        <RouteCompletionDialog open onClose={onClose} />
      </div>,
    );

    const backdrop = screen.getByRole("dialog").parentElement!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledOnce();
    expect(mapClick).not.toHaveBeenCalled();
  });

  it("formats distance and elevation in the preferred units", () => {
    useStore.setState({ units: "imperial" });
    render(
      <RouteCompletionDialog
        open
        distance={1609.344}
        elevationGain={100}
        duration={8_040}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("1.00 mi")).toBeTruthy();
    expect(screen.getByText("328 ft")).toBeTruthy();
    expect(screen.getByText("2h 14m")).toBeTruthy();
  });
});
