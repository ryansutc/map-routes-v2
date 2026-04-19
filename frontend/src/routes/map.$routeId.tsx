import LayerController from "@/components/map/LayerController";
import MapContainer from "@/components/map/MapContainer";
import PhotoController from "@/components/map/PhotoController";
import RouteInfoContainer from "@/components/map/RouteInfoContainer";
import Toggle3d from "@/components/map/Toggle3d";
import { useRoute } from "@/hooks/useRoute";
import theme from "@/utils/muitheme";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { Grid, useMediaQuery } from "@mui/material";

import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
export const Route = createFileRoute("/map/$routeId")({
  component: MapComponent,
});

function MapComponent() {
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const routeId = parseInt(window.location.pathname.replace("/map/", ""));

  const { data: routeItem, isLoading, error, isError } = useRoute(routeId);

  //const { routeId } = useParams({ strict: false }) as { routeId: string };

  const [map, setMap] = useState<Map | null>(null);
  const [view, setView] = useState<MapView | SceneView | null>(null);

  const viewDiv = React.useRef<HTMLDivElement>(
    null
  ) as React.RefObject<HTMLDivElement>;
  const handleMapLoad = (map: Map, view: MapView | SceneView) => {
    console.log("Map loaded");
    setMap(map);
    setView(view);
  };

  const handleMapReady = () => {
    console.log("Map ready");
  };

  const handleMapUnload = () => {
    console.log("Map unloaded");
  };

  const handleFail = (err: string) => {
    console.error(err);
  };

  const handleMapClick = (e: __esri.ViewClickEvent) => {
    const coords = `${
      Math.round((e.mapPoint?.latitude || 0) * 10000) / 10000
    }, ${Math.round((e.mapPoint?.longitude || 0) * 10000) / 10000}`;
    // eslint-disable-next-line no-console
    console.log(`Coordinates: ${coords} (${e.x},${e.y})`);
  };
  if (!isLoading) {
    // eslint-disable-next-line no-console
    console.log("Route Item:", routeItem?.routeLink);
  }
  return (
    <Grid container sx={{ height: "calc(100vh - 64px)", width: "100%", px: 0 }}>
      {/* Map Column  or Row */}
      <Grid size={{ xs: 12, sm: 8 }} sx={{ paddingRight: !isMobile ? 2 : 0 }}>
        <div
          id="viewDiv"
          style={{ width: "100%", height: "100%", position: "relative" }}
          ref={viewDiv}
        >
          <MapContainer
            attachToId="viewDiv"
            mapProperties={{
              basemap: "satellite", //"topo-vector",
            }}
            viewProperties={{
              center: [-122.55, 49.3],
              zoom: 6,
            }}
            onClick={handleMapClick}
            onFail={handleFail}
            onLoad={handleMapLoad}
            onReady={handleMapReady}
            onUnload={handleMapUnload}
          >
            {isError && <div>Error loading route: {error.message}</div>}
            {isLoading && <div>Loading route...</div>}
            {map &&
              view &&
              viewDiv?.current &&
              !isError &&
              !isLoading &&
              routeItem && (
                <>
                  <LayerController
                    map={map}
                    // @ts-expect-error routeLink is a string
                    layers={[routeItem?.routeLink]}
                    view={view}
                  />
                  <PhotoController
                    map={map}
                    photos={routeItem?.photos || []}
                    view={view}
                  />
                  <Toggle3d />
                </>
              )}
          </MapContainer>
        </div>
      </Grid>

      {/* Route Info Column or Row */}
      <Grid
        size={{ xs: 12, sm: 4 }}
        sx={{ px: isMobile ? 4 : 0, paddingLeft: !isMobile ? 2 : 0 }}
      >
        {routeItem && <RouteInfoContainer routeItem={routeItem} />}
      </Grid>
    </Grid>
  );
}
