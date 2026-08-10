// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LayerController from "./LayerController";

const mocks = vi.hoisted(() => ({
  enqueueError: vi.fn(),
  featureLayer: null as object | null,
  layerViewErrorListener: null as
    | ((event: { layer: object; error: unknown }) => void)
    | null,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ enqueueError: mocks.enqueueError }),
}));
vi.mock("@arcgis/core/layers/GeoJSONLayer", () => ({
  default: class MockGeoJSONLayer {
    constructor() {
      mocks.featureLayer = this;
    }

    when = vi.fn();
  },
}));
vi.mock("@arcgis/core/renderers/SimpleRenderer", () => ({
  default: class MockSimpleRenderer {},
}));
vi.mock("@arcgis/core/symbols/SimpleLineSymbol", () => ({
  default: class MockSimpleLineSymbol {},
}));
vi.mock("@arcgis/core/widgets/Home", () => ({
  default: class MockHome {},
}));

describe("LayerController cancelled view creation", () => {
  beforeEach(() => {
    mocks.enqueueError.mockClear();
    mocks.featureLayer = null;
    mocks.layerViewErrorListener = null;
  });

  afterEach(cleanup);

  it("does not report an expected AbortError while replacing the view", () => {
    const map = {
      add: vi.fn(),
      findLayerById: vi.fn(() => null),
      remove: vi.fn(),
    };
    const view = {
      on: vi.fn(
        (
          _eventName: string,
          listener: (event: { layer: object; error: unknown }) => void,
        ) => {
          mocks.layerViewErrorListener = listener;
          return { remove: vi.fn() };
        },
      ),
      ui: { add: vi.fn(), remove: vi.fn() },
    };

    render(
      <LayerController
        getMap={() => map as unknown as __esri.Map}
        getView={() => view as unknown as __esri.MapView}
        layers={["route-layer"]}
      />,
    );

    act(() => {
      mocks.layerViewErrorListener?.({
        layer: mocks.featureLayer!,
        error: { name: "AbortError", message: "Aborted" },
      });
    });

    expect(mocks.enqueueError).not.toHaveBeenCalled();
  });
});
