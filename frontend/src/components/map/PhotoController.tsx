import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import WebStyleSymbol from "@arcgis/core/symbols/WebStyleSymbol.js";
import { PHOTO_MARKERS_LAYER_ID } from "./mapLayerOrder";

import type { PhotoDto } from "@/types/api";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import { useEffect } from "react";

function PhotoController({
  getMap,
  getView,
  photos,
  onPhotoClick,
}: {
  getMap: () => __esri.Map | null;
  getView: () => MapView | SceneView | null;
  photos: PhotoDto[];
  onPhotoClick: (index: number) => void;
}) {
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
      if (
        typeof photo.longitude !== "number" ||
        typeof photo.latitude !== "number"
      ) {
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

    const clickHandle = view.on("click", async (event) => {
      const response = await view.hitTest(event, { include: graphicsLayer });
      const result = response.results.find((item) => item.type === "graphic");
      if (!result || !("graphic" in result)) return;
      const photoIndex = result.graphic.attributes?.photoIndex;
      if (typeof photoIndex === "number") onPhotoClick(photoIndex);
    });

    return () => {
      clickHandle.remove();
      map.remove(graphicsLayer);
    };
  }, [getMap, getView, onPhotoClick, photos]);

  return null;
}

export default PhotoController;
