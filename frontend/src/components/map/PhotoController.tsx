import { dropboxShareUrlToDirectDownload } from "@/utils/dropboxImgHelpers";
import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

import type { PhotoDto } from "@/types/api";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useEffect } from "react";

function PhotoController({
  map,
  photos,
  view,
}: {
  map: __esri.Map | null;
  view: MapView | SceneView | null;
  photos: PhotoDto[];
}) {
  useEffect(() => {
    if (map && view && view) {
      photos.forEach((photo) => {
        const template = {
          title: photo.title || "No Photo Title Available",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "ObjectID",
                  label: "Object ID",
                  visible: false,
                },
              ],
            },
            {
              type: "media",
              //title: "this is some media",
              mediaInfos: [
                {
                  type: "image",
                  caption: photo.title,
                  value: {
                    sourceURL: dropboxShareUrlToDirectDownload(photo.url!),
                    altText: photo.title,
                  },
                },
              ],
            },
          ],
        };

        // create graphics:
        // Import Graphic from ArcGIS
        const pointGraphic = new Graphic({
          geometry: {
            type: "point",
            longitude: photo.longitude,
            latitude: photo.latitude,
          },
          attributes: {
            ObjectID: photo.id,
            imgUrl: dropboxShareUrlToDirectDownload(
              "https://www.dropbox.com/scl/fi/d4niv56474j71wmxm9syn/IMG_3966.JPG?rlkey=kotg5yywjqzus0dd2ywihiasw&st=uxxsbxnx&dl=0"
            ),
          },
        });

        // Add new Graphics Point Layer to the map:
        const graphicsLayer = new FeatureLayer({
          id: "graphicsLayer",
          source: [pointGraphic],
          fields: [
            {
              name: "ObjectID",
              type: "oid",
            },
            {
              name: "imgUrl",
              type: "string",
            },
          ],
          objectIdField: "ObjectID",
          geometryType: "point",
          popupTemplate: template,
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-marker",
              color: [40, 119, 226], // blue color
              size: 8, // size as number, not string
              outline: {
                color: [255, 255, 255],
                width: 1,
              },
            },
          },
        });

        map.add(graphicsLayer);
      });
    }

    return () => {
      if (map) {
        // @ts-expect-error layer problem TODO
        photos.forEach((layer) => map.remove(map.findLayerById(layer)));
        const graphicsLayer = map.findLayerById("graphicsLayer");
        if (graphicsLayer) map.remove(graphicsLayer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export default PhotoController;
