import type { BasemapOption } from "@/components/map/BasemapSelector";
import Basemap from "@arcgis/core/Basemap";
import type Map from "@arcgis/core/Map";

const THUMBNAIL_ROOT =
  "https://js.arcgis.com/4.33/@arcgis/core/assets/esri/images/basemap";

export const DEFAULT_BASEMAP_ID = "satellite";

/**
 * The route-detail choices backed by ArcGIS's legacy well-known basemaps.
 * These endpoints are public and do not use the authenticated/billable v2
 * basemap styles service.
 */
export const ARCGIS_BASEMAP_OPTIONS = [
  {
    id: "satellite",
    label: "Satellite",
    thumbnailUrl: `${THUMBNAIL_ROOT}/satellite.jpg`,
  },
  {
    id: "hybrid",
    label: "Hybrid",
    thumbnailUrl: `${THUMBNAIL_ROOT}/hybrid.jpg`,
  },
  {
    id: "topo-vector",
    label: "Topographic",
    thumbnailUrl: `${THUMBNAIL_ROOT}/topo-vector.jpg`,
  },
  {
    id: "terrain",
    label: "Terrain",
    thumbnailUrl: `${THUMBNAIL_ROOT}/terrain.jpg`,
  },
  {
    id: "gray-vector",
    label: "Light Gray",
    thumbnailUrl: `${THUMBNAIL_ROOT}/gray-vector.jpg`,
  },
  {
    id: "dark-gray-vector",
    label: "Dark Gray",
    thumbnailUrl: `${THUMBNAIL_ROOT}/dark-gray-vector.jpg`,
  },
] as const satisfies readonly BasemapOption[];

export type ArcGISBasemapId = (typeof ARCGIS_BASEMAP_OPTIONS)[number]["id"];

export function isArcGISBasemapId(id: string): id is ArcGISBasemapId {
  return ARCGIS_BASEMAP_OPTIONS.some((option) => option.id === id);
}

/** Load first and assign second, so a failed choice never blanks the map. */
export async function switchArcGISBasemap(
  map: Map,
  id: ArcGISBasemapId,
): Promise<void> {
  const candidate = Basemap.fromId(id);
  if (!candidate) throw new Error(`Unknown basemap: ${id}`);

  await candidate.loadAll();
  map.basemap = candidate;
}
