// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/LayerController", () => ({ default: () => null }));
vi.mock("@/components/map/PhotoController", () => ({ default: () => null }));
vi.mock("@/components/map/Toggle3d", () => ({ default: () => null }));
vi.mock("@/components/routes/RouteAnimationController", () => ({
  RouteAnimationController: () => null,
}));

import { RouteMapOverlays } from "./$routeId";

type Props = ComponentProps<typeof RouteMapOverlays>;

const baseProps: Props = {
  getMap: () => ({}) as ReturnType<Props["getMap"]>,
  getView: () => ({}) as ReturnType<Props["getView"]>,
  routeItem: {
    arcgis_item_id: null,
    photos: [],
  } as unknown as Props["routeItem"],
  routeTrack: {} as Props["routeTrack"],
  error: null,
  isLoading: false,
  isPreview: false,
  isAnimating: false,
  isChangingBasemap: false,
  selectedBasemapId: "satellite",
  onBasemapSelect: vi.fn(),
  onPhotoClick: vi.fn(),
  onPlayingChange: vi.fn(),
  timedPhotoPresenter: {} as Props["timedPhotoPresenter"],
  automaticPhoto: null,
  photoMapAnchor: null,
  onPhotoMapAnchorChange: vi.fn(),
  onPhotoSessionControllerChange: vi.fn(),
};

afterEach(cleanup);

describe("route detail basemap control", () => {
  it("shows on an interactive map, hides in preview, and disables for animation", () => {
    const { rerender } = render(<RouteMapOverlays {...baseProps} />);
    const button = screen.getByRole("button", { name: "Choose basemap" });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    rerender(<RouteMapOverlays {...baseProps} isAnimating />);
    expect(
      (screen.getByRole("button", {
        name: "Choose basemap",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(<RouteMapOverlays {...baseProps} isPreview />);
    expect(
      screen.queryByRole("button", { name: "Choose basemap" }),
    ).toBeNull();
  });
});
