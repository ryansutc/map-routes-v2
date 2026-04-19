import { useStore } from "@/state/store";
import ElevationLayer from "@arcgis/core/layers/ElevationLayer";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";

import React, { useEffect, useRef } from "react";

interface MapContainerProps {
  children?: React.ReactNode;
  attachToId: string;
  mapProperties: __esri.MapProperties;
  onClick: (e: __esri.ViewClickEvent) => void;
  onFail: (err: string) => void;
  onLoad: (map: Map, view: SceneView | MapView) => void;
  onReady: () => void;
  onUnload: () => void;
  viewProperties: { center: [number, number]; zoom: number };
}

// borrowed from my old repo: https://gitlab.com/ryansutc/reactesrimaptemplate
const MapContainer = (props: MapContainerProps) => {
  const {
    children,
    attachToId,
    mapProperties,
    onClick,
    onFail,
    onLoad,
    onReady,
    onUnload,
    viewProperties,
  } = props;

  const viewMode = useStore((state) => state.viewMode);

  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize or destroy the ESRI Map/View Instances
    if (mapDiv.current) {
      try {
        const newMap = new Map({
          ...mapProperties,
          ground: {
            layers: [
              new ElevationLayer({
                url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
              }),
            ],
          },
        });
        let newView;
        if (viewMode === "2d") {
          newView = new MapView({
            container: attachToId,
            map: newMap,
            ...viewProperties,
          });
        } else {
          newView = new SceneView({
            container: attachToId,
            map: newMap,
            ...viewProperties,
          });
        }

        newView.ui.move("zoom", "top-right");

        if (onClick) {
          newView.on("click", onClick);
        }
        // run stuff provided in onLoad
        if (onLoad) {
          if (newView.type == "3d") {
            (newView as unknown as SceneView).qualityProfile = "high";
          }

          onLoad(newMap, newView);
        }
        newView.when(() => {
          onReady();
        });
      } catch (err: unknown) {
        if (onFail) {
          if (err === "string") {
            onFail(err);
          } else {
            onFail((err as Error).message ?? (err as object).toString());
          }
        }
      }
    }
    return () => {
      onUnload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  return (
    <div
      style={{ height: "100%", width: "100%" }}
      ref={mapDiv}
      id={props.attachToId}
    >
      {children ? children : null}
    </div>
  );
};

export default MapContainer;
