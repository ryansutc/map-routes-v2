import { beforeEach, describe, expect, it, vi } from "vitest";

const basemapMock = vi.hoisted(() => ({ fromId: vi.fn() }));

vi.mock("@arcgis/core/Basemap", () => ({
  default: { fromId: basemapMock.fromId },
}));

import {
  ARCGIS_BASEMAP_OPTIONS,
  switchArcGISBasemap,
} from "./arcgisBasemaps";

describe("ArcGIS basemap adapter", () => {
  beforeEach(() => basemapMock.fromId.mockReset());

  it("exposes the six anonymous legacy choices in product order", () => {
    expect(ARCGIS_BASEMAP_OPTIONS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "satellite", label: "Satellite" },
      { id: "hybrid", label: "Hybrid" },
      { id: "topo-vector", label: "Topographic" },
      { id: "terrain", label: "Terrain" },
      { id: "gray-vector", label: "Light Gray" },
      { id: "dark-gray-vector", label: "Dark Gray" },
    ]);
  });

  it("assigns a basemap only after all of its resources load", async () => {
    const candidate = { loadAll: vi.fn().mockResolvedValue(undefined) };
    basemapMock.fromId.mockReturnValue(candidate);
    const previous = { id: "satellite" };
    const map = { basemap: previous };

    await switchArcGISBasemap(
      map as unknown as import("@arcgis/core/Map").default,
      "terrain",
    );

    expect(candidate.loadAll).toHaveBeenCalledOnce();
    expect(map.basemap).toBe(candidate);
  });

  it("retains the previous basemap when loading fails", async () => {
    const candidate = {
      loadAll: vi.fn().mockRejectedValue(new Error("network")),
    };
    basemapMock.fromId.mockReturnValue(candidate);
    const previous = { id: "satellite" };
    const map = { basemap: previous };

    await expect(
      switchArcGISBasemap(
        map as unknown as import("@arcgis/core/Map").default,
        "terrain",
      ),
    ).rejects.toThrow("network");
    expect(map.basemap).toBe(previous);
  });
});
