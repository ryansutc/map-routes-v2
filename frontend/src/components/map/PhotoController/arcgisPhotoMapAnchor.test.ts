import type Graphic from "@arcgis/core/Graphic";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import { describe, expect, it, vi } from "vitest";
import { createArcGisPhotoMapAnchor } from "./arcgisPhotoMapAnchor";

describe("createArcGisPhotoMapAnchor", () => {
  it.each(["2d", "3d"] as const)(
    "projects and observes permanent markers in a %s view",
    (type) => {
      const watchCallbacks: Array<() => void> = [];
      const remove = vi.fn();
      const view = {
        type,
        width: 800,
        height: 600,
        toScreen: vi.fn(() => ({ x: 200, y: 150 })),
        watch: vi.fn((_property: string, callback: () => void) => {
          watchCallbacks.push(callback);
          return { remove };
        }),
      } as unknown as MapView | SceneView;
      const graphic = { geometry: { type: "point" } } as unknown as Graphic;
      const adapter = createArcGisPhotoMapAnchor(
        view,
        new Map([[7, graphic]]),
      );
      const listener = vi.fn();
      adapter.subscribe(listener);

      expect(adapter.getSnapshot(7)).toEqual({
        x: 200,
        y: 150,
        viewportWidth: 800,
        viewportHeight: 600,
        visible: true,
      });
      expect(adapter.getSnapshot(99)).toBeNull();
      watchCallbacks.forEach((callback) => callback());
      expect(listener).toHaveBeenCalledTimes(3);

      adapter.destroy();
      expect(remove).toHaveBeenCalledTimes(3);
    },
  );

  it("requires the entire marker to be inside the viewport", () => {
    const view = {
      type: "2d",
      width: 320,
      height: 240,
      toScreen: () => ({ x: 10, y: 120 }),
      watch: () => ({ remove: () => {} }),
    } as unknown as MapView;
    const graphic = { geometry: { type: "point" } } as unknown as Graphic;
    const adapter = createArcGisPhotoMapAnchor(
      view,
      new Map([[7, graphic]]),
    );

    expect(adapter.getSnapshot(7)?.visible).toBe(false);
    adapter.destroy();
  });
});
