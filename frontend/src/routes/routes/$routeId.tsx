import LayerController from "@/components/map/LayerController";
import MapContainer from "@/components/map/MapContainer";
import PhotoController from "@/components/map/PhotoController";
import RouteInfoContainer, {
  RouteInfoSkeleton,
} from "@/components/map/RouteInfoContainer";
import Toggle3d from "@/components/map/Toggle3d";
import PhotoGallery from "@/components/routes/PhotoGallery";
import { useRoute } from "@/hooks/useRoute.tsx";
import theme from "@/utils/muitheme";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import { Box, Grid, Typography, useMediaQuery } from "@mui/material";

import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";

export const Route = createFileRoute("/routes/$routeId")({
  parseParams: ({ routeId }) => {
    const parsed = parseInt(routeId, 10);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid route id");
    }
    return { routeId: parsed };
  },
  stringifyParams: ({ routeId }) => ({ routeId: String(routeId) }),
  component: RouteDetail,
  errorComponent: RouteDetailError,
  notFoundComponent: RouteNotFound,
});

function RouteDetail() {
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { routeId } = Route.useParams();

  const { data: routeItem, isLoading, error, isError } = useRoute(routeId);

  const [map, setMap] = useState<Map | null>(null);
  const [view, setView] = useState<MapView | SceneView | null>(null);

  const viewDiv = React.useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;

  const handleMapLoad = (map: Map, view: MapView | SceneView) => {
    setMap(map);
    setView(view);
  };

  const handleMapReady = () => {};
  const handleMapUnload = () => {};
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

  return (
    <Grid container sx={{ height: "calc(100vh - 64px)", width: "100%", px: 0 }}>
      <Grid size={{ xs: 12, sm: 8 }} sx={{ paddingRight: !isMobile ? 2 : 0 }}>
        <div
          id="viewDiv"
          style={{ width: "100%", height: "100%", position: "relative" }}
          ref={viewDiv}
        >
          <MapContainer
            attachToId="viewDiv"
            mapProperties={{
              basemap: "satellite",
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
                    // @ts-expect-error value can be undefined
                    layers={
                      (routeItem?.route_link && [routeItem?.route_link]) ?? []
                    }
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

      <Grid
        size={{ xs: 12, sm: 4 }}
        sx={{
          px: isMobile ? 4 : 0,
          paddingLeft: !isMobile ? 2 : 0,
          overflowY: "auto",
          height: isMobile ? "auto" : "calc(100vh - 64px)",
        }}
      >
        {isLoading && <RouteInfoSkeleton />}
        {routeItem && (
          <>
            <RouteInfoContainer routeItem={routeItem} />
            <Box sx={{ px: 2, pb: 2 }}>
              <PhotoGallery photos={routeItem.photos} />
            </Box>
          </>
        )}
      </Grid>
    </Grid>
  );
}

function RouteDetailError({ error }: { error: Error }) {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Couldn't load route
      </Typography>
      <Typography color="text.secondary">{error.message}</Typography>
    </Box>
  );
}

function RouteNotFound() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Route not found
      </Typography>
      <Typography color="text.secondary">
        We couldn't find the route you were looking for.
      </Typography>
    </Box>
  );
}
