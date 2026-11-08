import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import WebStyleSymbol from "@arcgis/core/symbols/WebStyleSymbol.js";
import { PHOTO_MARKERS_LAYER_ID } from "../layers/mapLayerOrder";
import { createArcGisPhotoMapAnchor } from "./arcgisPhotoMapAnchor";
import {
  createArcGisPhotoMarkerInteractions,
  type ArcGisPhotoMarkerInteractions,
} from "./arcgisPhotoMarkerInteractions";
import type { PhotoMapAnchor } from "@/domain/photoMapAnchor";

import { hasValidPhotoGps } from "@/domain/timedPhotoEvents";
import type { PhotoDto } from "@/types/api";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import { useEffect, useRef } from "react";

function PhotoController({
  getMap,
  getView,
  photos,
  openPhotoId,
  onPhotoClick,
  onMapAnchorChange,
}: {
  getMap: () => __esri.Map | null;
  getView: () => MapView | SceneView | null;
  photos: PhotoDto[];
  openPhotoId: number | null;
  onPhotoClick: (index: number) => void;
  onMapAnchorChange?: (anchor: PhotoMapAnchor | null) => void;
}) {
  const interactionsRef = useRef<ArcGisPhotoMarkerInteractions | null>(null);
  const openPhotoIdRef = useRef(openPhotoId);

  useEffect(() => {
    openPhotoIdRef.current = openPhotoId;
    interactionsRef.current?.setOpenPhotoId(openPhotoId);
  }, [openPhotoId]);

  useEffect(() => {
    const map = getMap();
    const view = getView();
    if (!map || !view || !photos.length) return;

    const photoSymbol = new WebStyleSymbol({
      name: "Landmark_POI-Large_3",
      styleUrl:
        "https://www.arcgis.com/sharing/rest/content/items/738c8d0e43464829bc816185f11eb954/data",
    });

    const graphics = photos.flatMap((photo, photoIndex) => {
      if (!hasValidPhotoGps(photo)) {
        return [];
      }

      return [
        new Graphic({
          geometry: {
            type: "point",
            longitude: photo.longitude,
            latitude: photo.latitude,
          },
          attributes: {
            ObjectID: photo.id,
            photoIndex,
          },
          symbol: photoSymbol,
        }),
      ];
    });

    const graphicsLayer = new GraphicsLayer({
      id: PHOTO_MARKERS_LAYER_ID,
      graphics,
    });

    map.add(graphicsLayer);
    const graphicsByPhotoId = new Map(
      graphics.map((graphic) => [
        graphic.attributes!.ObjectID as number,
        graphic,
      ]),
    );
    const mapAnchor = createArcGisPhotoMapAnchor(view, graphicsByPhotoId);
    onMapAnchorChange?.(mapAnchor);

    let disposed = false;
    void createArcGisPhotoMarkerInteractions(
      view,
      graphicsLayer,
      graphicsByPhotoId,
    )
      .then((interactions) => {
        if (disposed) {
          interactions.destroy();
          return;
        }
        interactionsRef.current = interactions;
        interactions.setOpenPhotoId(openPhotoIdRef.current);
      })
      .catch(() => {
        // The view may be destroyed while its layer view is still resolving.
      });

    const clickHandle = view.on("click", async (event) => {
      const response = await view.hitTest(event, { include: graphicsLayer });
      const result = response.results.find((item) => item.type === "graphic");
      if (!result || !("graphic" in result)) return;
      const photoIndex = result.graphic.attributes?.photoIndex;
      if (typeof photoIndex === "number") onPhotoClick(photoIndex);
    });

    return () => {
      disposed = true;
      interactionsRef.current?.destroy();
      interactionsRef.current = null;
      onMapAnchorChange?.(null);
      mapAnchor.destroy();
      clickHandle.remove();
      map.remove(graphicsLayer);
    };
  }, [getMap, getView, onMapAnchorChange, onPhotoClick, photos]);

  return null;
}

export default PhotoController;
