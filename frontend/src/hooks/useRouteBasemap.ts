import {
  DEFAULT_BASEMAP_ID,
  switchArcGISBasemap,
  type ArcGISBasemapId,
} from "@/components/map/arcgisBasemaps";
import type Map from "@arcgis/core/Map";
import { useCallback, useEffect, useRef, useState } from "react";

export function useRouteBasemap(
  routeId: number,
  onError: (message: string) => void,
) {
  const [selection, setSelection] = useState<{
    routeId: number;
    id: ArcGISBasemapId;
  }>(() => ({ routeId, id: DEFAULT_BASEMAP_ID }));
  const [changingRouteId, setChangingRouteId] = useState<number | null>(null);
  const mapRef = useRef<Map | null>(null);
  const requestRef = useRef(0);
  const selectedId =
    selection.routeId === routeId ? selection.id : DEFAULT_BASEMAP_ID;
  const isChanging = changingRouteId === routeId;

  const registerMap = useCallback((map: Map) => {
    mapRef.current = map;
  }, []);

  const select = useCallback(
    async (id: ArcGISBasemapId) => {
      const targetMap = mapRef.current;
      if (!targetMap || id === selectedId) return;

      const request = ++requestRef.current;
      setChangingRouteId(routeId);
      try {
        await switchArcGISBasemap(targetMap, id);

        // A view-mode change can replace the map while loading. Carry the
        // choice into that replacement before committing the selected state.
        const currentMap = mapRef.current;
        if (currentMap && currentMap !== targetMap) {
          await switchArcGISBasemap(currentMap, id);
        }
        if (requestRef.current === request) setSelection({ routeId, id });
      } catch {
        if (requestRef.current === request) {
          onError("Couldn't load that basemap. The previous map was kept.");
        }
      } finally {
        if (requestRef.current === request) setChangingRouteId(null);
      }
    },
    [onError, routeId, selectedId],
  );

  // TanStack file-route params can change without remounting. This makes the
  // selection local to one route while preserving it across view rebuilds.
  useEffect(() => {
    const request = ++requestRef.current;

    const currentMap = mapRef.current;
    if (currentMap && currentMap.basemap?.id !== DEFAULT_BASEMAP_ID) {
      void switchArcGISBasemap(currentMap, DEFAULT_BASEMAP_ID).catch(() => {
        if (requestRef.current === request) {
          onError("Couldn't restore the default Satellite basemap.");
        }
      });
    }
  }, [onError, routeId]);

  return { selectedId, isChanging, registerMap, select };
}
