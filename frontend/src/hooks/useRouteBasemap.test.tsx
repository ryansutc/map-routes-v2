// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({ switchBasemap: vi.fn() }));

vi.mock("@/components/map/arcgisBasemaps", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/components/map/arcgisBasemaps")
    >();
  return { ...original, switchArcGISBasemap: adapter.switchBasemap };
});

import type Map from "@arcgis/core/Map";
import { useRouteBasemap } from "./useRouteBasemap";

function mockMap(id: string) {
  return { basemap: { id } } as unknown as Map;
}

describe("useRouteBasemap", () => {
  beforeEach(() => adapter.switchBasemap.mockReset().mockResolvedValue(undefined));
  afterEach(cleanup);

  it("starts at Satellite and carries a choice across a map rebuild", async () => {
    let finishFirstLoad!: () => void;
    adapter.switchBasemap.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishFirstLoad = resolve)),
    );
    const onError = vi.fn();
    const { result } = renderHook(() => useRouteBasemap(7, onError));
    const firstMap = mockMap("satellite");
    const rebuiltMap = mockMap("satellite");

    act(() => result.current.registerMap(firstMap));
    let selection!: Promise<void>;
    act(() => {
      selection = result.current.select("terrain");
    });
    expect(result.current.isChanging).toBe(true);

    act(() => result.current.registerMap(rebuiltMap));
    finishFirstLoad();
    await act(() => selection);

    expect(adapter.switchBasemap).toHaveBeenNthCalledWith(1, firstMap, "terrain");
    expect(adapter.switchBasemap).toHaveBeenNthCalledWith(2, rebuiltMap, "terrain");
    expect(result.current.selectedId).toBe("terrain");
    expect(result.current.isChanging).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps the working choice on failure and resets for another route", async () => {
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      ({ routeId }) => useRouteBasemap(routeId, onError),
      { initialProps: { routeId: 7 } },
    );
    const map = mockMap("satellite");
    act(() => result.current.registerMap(map));

    adapter.switchBasemap.mockRejectedValueOnce(new Error("network"));
    await act(() => result.current.select("hybrid"));
    expect(result.current.selectedId).toBe("satellite");
    expect(onError).toHaveBeenCalledWith(
      "Couldn't load that basemap. The previous map was kept.",
    );

    adapter.switchBasemap.mockResolvedValue(undefined);
    await act(() => result.current.select("terrain"));
    expect(result.current.selectedId).toBe("terrain");
    (map.basemap as { id: string }).id = "terrain";

    rerender({ routeId: 8 });
    expect(result.current.selectedId).toBe("satellite");
    await waitFor(() =>
      expect(adapter.switchBasemap).toHaveBeenLastCalledWith(map, "satellite"),
    );
  });
});
