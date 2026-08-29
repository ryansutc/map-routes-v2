// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "@/state/store";
import MapContainer from "./MapContainer";

const arcgis = vi.hoisted(() => {
  const owners = new Map<string, MockView>();
  const views: MockView[] = [];

  class MockView {
    type: "2d" | "3d";
    ui = {
      find: vi.fn(() => ({ visible: true })),
      move: vi.fn(),
    };
    destroyed = false;
    ready = false;
    blocked: boolean;
    private _container: string | null;
    readyCallback: (() => void) | null = null;

    constructor(properties: { container: string }, type: "2d" | "3d") {
      this.type = type;
      this._container = properties.container;
      const owner = owners.get(this._container);
      this.blocked = Boolean(owner && !owner.destroyed && !owner.ready);
      owners.set(this._container, this);
      views.push(this);
    }

    get container() {
      return this._container;
    }

    set container(container: string | null) {
      if (this._container && owners.get(this._container) === this) {
        owners.delete(this._container);
      }
      this._container = container;
      if (container) owners.set(container, this);
    }

    on = vi.fn();

    when(callback: () => void) {
      if (!this.blocked) this.readyCallback = callback;
    }

    resolveReady() {
      this.ready = true;
      this.readyCallback?.();
    }

    destroy() {
      this.destroyed = true;
      this.container = null;
    }
  }

  return {
    MockView,
    owners,
    reset() {
      owners.clear();
      views.length = 0;
    },
    views,
  };
});

vi.mock("@arcgis/core/config", () => ({ default: {} }));
vi.mock("@arcgis/core/layers/ElevationLayer", () => ({
  default: class MockElevationLayer {},
}));
vi.mock("@arcgis/core/Map", () => ({
  default: class MockMap {},
}));
vi.mock("@arcgis/core/views/MapView", () => ({
  default: class MockMapView extends arcgis.MockView {
    constructor(properties: { container: string }) {
      super(properties, "2d");
    }
  },
}));
vi.mock("@arcgis/core/views/SceneView", () => ({
  default: class MockSceneView extends arcgis.MockView {
    qualityProfile = "low";

    constructor(properties: { container: string }) {
      super(properties, "3d");
    }
  },
}));

describe("MapContainer rapid view-mode toggles", () => {
  beforeEach(() => {
    arcgis.reset();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    useStore.setState({ viewMode: "2d" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("initializes the final 2D view after a rapid 2D to 3D to 2D toggle", async () => {
    const onReady = vi.fn();

    render(
      <MapContainer
        attachToId="rapid-toggle-map"
        mapProperties={{}}
        onClick={vi.fn()}
        onFail={vi.fn()}
        onLoad={vi.fn()}
        onReady={onReady}
        onUnload={vi.fn()}
        viewProperties={{ center: [0, 0], zoom: 1 }}
      />,
    );

    act(() => arcgis.views[0]!.resolveReady());
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));

    act(() => useStore.getState().setViewMode("3d"));
    act(() => useStore.getState().setViewMode("2d"));
    act(() => arcgis.views.at(-1)?.resolveReady());

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
    expect(arcgis.views.map((view) => view.type)).toEqual(["2d", "3d", "2d"]);
  });

});
