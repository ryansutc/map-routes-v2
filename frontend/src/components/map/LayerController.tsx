import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";
function LayerController({
  map,
  layers,
  view,
}: {
  map: __esri.Map | null;
  view: MapView | SceneView | null;
  layers: string[];
}) {
  const { enqueueError } = useToast();
  useEffect(() => {
    if (map && view && view) {
      layers.forEach((layer) => {
        const renderer = new SimpleRenderer({
          symbol: new SimpleLineSymbol({
            color: [255, 145, 0, 255],
            width: 2,
          }),
        });
        /**
         * Due to changes in ArcGIS Online, we cannot get FeatureCollections directly converted from
         * GPX files. Instead we convert gpx files to GeoJSON via online or GDAL as users,
         * and then we have to publish these to ArcGIS Online and share them publically.
         *
         * When they are public, we can simply copy the item Id.
         *
         */
        const featureLayer = new GeoJSONLayer({
          id: layer,
          portalItem: {
            id: layer, // TODO convert all items to geoJSON and see if that messes up planned animation process
          },
          renderer: renderer,
        });

        map.add(featureLayer);

        let loadFailed = false;

        view.on("layerview-create-error", (event) => {
          if (event.layer === featureLayer && !loadFailed) {
            enqueueError(`Failed to display map layer "${layer}".`);
            console.error(`layerview-create-error for layer "${layer}":`, event.error);
          }
        });

        featureLayer.when(
          () => {
            featureLayer.queryExtent().then((res) => {
              if (view && view.ready) {
                view.goTo(res.extent).catch((error) => {
                  console.warn("Error during view.goTo:", error);
                });
              } else {
                view?.when(() => {
                  view.goTo(res.extent).catch((error) => {
                    console.warn("Error during view.goTo:", error);
                  });
                });
              }
            });
          },
          (error: unknown) => {
            loadFailed = true;
            enqueueError(`Failed to load map layer "${layer}".`);
            console.error(`Layer "${layer}" failed to load:`, error);
          }
        );
      });
    }

    return () => {
      if (map) {
        // @ts-expect-error layer problem TODO
        layers.forEach((layer) => map.remove(map.findLayerById(layer)));
        const graphicsLayer = map.findLayerById("graphicsLayer");
        if (graphicsLayer) map.remove(graphicsLayer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export default LayerController;
