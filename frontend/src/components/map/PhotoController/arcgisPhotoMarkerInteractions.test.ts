// @vitest-environment jsdom

import type Graphic from "@arcgis/core/Graphic";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import type MapView from "@arcgis/core/views/MapView";
import { describe, expect, it, vi } from "vitest";

vi.mock("@arcgis/core/core/promiseUtils", () => ({
  debounce: <T>(callback: T) => callback,
  isAbortError: () => false,
}));

vi.mock("@arcgis/core/views/support/HighlightOptions", () => ({
  default: class MockHighlightOptions {
    name = "";

    constructor(properties: { name?: string }) {
      Object.assign(this, properties);
    }
  },
}));

import { createArcGisPhotoMarkerInteractions } from "./arcgisPhotoMarkerInteractions";

describe("createArcGisPhotoMarkerInteractions", () => {
  it("shows pointer, hover, and open-photo states and cleans them up", async () => {
    const layer = {} as GraphicsLayer;
    const graphic = { layer } as unknown as Graphic;
    const eventHandlers = new Map<string, (event?: unknown) => void>();
    const eventRemovers: ReturnType<typeof vi.fn>[] = [];
    const highlightHandles: Array<{
      name: string;
      graphic: Graphic;
      remove: ReturnType<typeof vi.fn>;
    }> = [];
    const layerView = {
      highlight: vi.fn((target: Graphic, options: { name: string }) => {
        const handle = { name: options.name, graphic: target, remove: vi.fn() };
        highlightHandles.push(handle);
        return handle;
      }),
    };
    const highlightOptions: unknown[] = [];
    const container = document.createElement("div");
    container.style.cursor = "grab";
    const view = {
      container,
      highlights: {
        addMany: (items: unknown[]) => highlightOptions.push(...items),
        remove: (item: unknown) => {
          const index = highlightOptions.indexOf(item);
          if (index >= 0) highlightOptions.splice(index, 1);
        },
      },
      whenLayerView: vi.fn(async () => layerView),
      hitTest: vi.fn(async () => ({ results: [{ type: "graphic", graphic }] })),
      on: vi.fn((name: string, handler: (event?: unknown) => void) => {
        eventHandlers.set(name, handler);
        const remove = vi.fn();
        eventRemovers.push(remove);
        return { remove };
      }),
    } as unknown as MapView;

    const interactions = await createArcGisPhotoMarkerInteractions(
      view,
      layer,
      new Map([[7, graphic]]),
    );

    eventHandlers.get("pointer-move")?.({ x: 10, y: 20 });
    await vi.waitFor(() => expect(container.style.cursor).toBe("pointer"));
    expect(highlightHandles.at(-1)?.name).toBe("route-photo-marker-hover");

    interactions.setOpenPhotoId(7);
    expect(highlightHandles.at(-1)?.name).toBe("route-photo-marker-selected");

    eventHandlers.get("pointer-leave")?.();
    expect(container.style.cursor).toBe("grab");
    expect(highlightHandles[0]?.remove).toHaveBeenCalledOnce();

    interactions.setOpenPhotoId(null);
    expect(highlightHandles[1]?.remove).toHaveBeenCalledOnce();

    interactions.destroy();
    expect(eventRemovers).toHaveLength(2);
    eventRemovers.forEach((remove) => expect(remove).toHaveBeenCalledOnce());
    expect(highlightOptions).toHaveLength(0);
    expect(container.style.cursor).toBe("grab");
  });
});
