import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

import type { PhotoDto } from "@/types/api";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useEffect } from "react";

function PhotoController({
  map,
  photos,
  view,
  onPhotoClick,
}: {
  map: __esri.Map | null;
  view: MapView | SceneView | null;
  photos: PhotoDto[];
  onPhotoClick: (index: number) => void;
}) {
  useEffect(() => {
    if (!map || !view || !photos.length) return;

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
          symbol: {
            type: "simple-marker",
            color: [40, 119, 226],
            size: 8,
            outline: {
              color: [255, 255, 255],
              width: 1,
            },
          },
        }),
      ];
    });

    const graphicsLayer = new GraphicsLayer({
      id: "photo-markers",
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
  }, [map, onPhotoClick, photos, view]);

  return null;
}

export default PhotoController;
