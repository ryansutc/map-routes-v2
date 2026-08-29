import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import type LayerController from "./LayerController";

type LayerControllerProps = ComponentProps<typeof LayerController>;

function diffEnumerableProps(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  depth = 0,
) {
  for (const key in next) {
    const previousValue = previous[key];
    const nextValue = next[key];
    if (
      depth < 3 &&
      previousValue !== null &&
      nextValue !== null &&
      typeof previousValue === "object" &&
      typeof nextValue === "object" &&
      Object.prototype.toString.call(previousValue) === "[object Object]" &&
      Object.prototype.toString.call(nextValue) === "[object Object]"
    ) {
      diffEnumerableProps(
        previousValue as Record<string, unknown>,
        nextValue as Record<string, unknown>,
        depth + 1,
      );
    }
  }
}

describe("React boundary for ArcGIS Accessors", () => {
  it("keeps a destroyed view behind an opaque getter prop", () => {
    const destroyedView = {};
    Object.defineProperty(destroyedView, "zoom", {
      enumerable: true,
      get() {
        throw new TypeError(
          "Cannot read properties of null (reading 'zoom')",
        );
      },
    });
    const replacementView = { zoom: 1 };

    const previousProps: LayerControllerProps = {
      getMap: () => null,
      getView: () => destroyedView as __esri.MapView,
      layers: [],
    };
    const nextProps: LayerControllerProps = {
      getMap: () => null,
      getView: () => replacementView as __esri.MapView,
      layers: [],
    };

    expect(() =>
      diffEnumerableProps(previousProps, nextProps),
    ).not.toThrow();

    expect(() =>
      diffEnumerableProps(
        { view: destroyedView },
        { view: replacementView },
      ),
    ).toThrow("Cannot read properties of null (reading 'zoom')");
  });
});
