// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BasemapSelector, { type BasemapOption } from "./BasemapSelector";

const OPTIONS: readonly BasemapOption[] = [
  { id: "satellite", label: "Satellite", thumbnailUrl: "/satellite.jpg" },
  { id: "terrain", label: "Terrain", thumbnailUrl: "/terrain.jpg" },
];

afterEach(cleanup);

describe("BasemapSelector", () => {
  it("renders radio choices, indicates the selection, and closes on selection", () => {
    const onSelect = vi.fn();
    render(
      <BasemapSelector
        options={OPTIONS}
        selectedId="satellite"
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button", { name: "Choose basemap" });
    fireEvent.click(button);

    const menu = screen.getByRole("menu", { name: "Basemaps" });
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Satellite",
      "Terrain",
    ]);
    expect(items[0]!.getAttribute("aria-checked")).toBe("true");
    expect(items[1]!.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(items[1]!);
    expect(onSelect).toHaveBeenCalledWith("terrain");
    expect(screen.queryByRole("menu", { name: "Basemaps" })).toBeNull();
  });

  it("supports Escape, disabled state, and a failed-thumbnail fallback", () => {
    const { rerender } = render(
      <BasemapSelector
        options={OPTIONS}
        selectedId="satellite"
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Choose basemap" });
    expect(getComputedStyle(button).width).toBe("44px");
    expect(getComputedStyle(button).height).toBe("44px");
    fireEvent.click(button);
    const failedImage = document.querySelector<HTMLImageElement>(
      'img[src="/terrain.jpg"]',
    );
    expect(failedImage).not.toBeNull();
    fireEvent.error(failedImage!);
    expect(document.querySelector('img[src="/terrain.jpg"]')).toBeNull();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    rerender(
      <BasemapSelector
        options={OPTIONS}
        selectedId="satellite"
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
