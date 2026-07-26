import ElevationProfile from "@/components/map/ElevationProfile";
import LayerController from "@/components/map/LayerController";
import MapContainer from "@/components/map/MapContainer";
import PhotoController from "@/components/map/PhotoController";
import RouteInfoContainer, {
  RouteInfoSkeleton,
} from "@/components/map/RouteInfoContainer";
import Toggle3d from "@/components/map/Toggle3d";
import PhotoGallery from "@/components/routes/PhotoGallery";
import { RouteAnimationController } from "@/components/routes/RouteAnimationController";
import { useElevationProfile } from "@/hooks/useElevationProfile";
import { useMapInteractionLock } from "@/hooks/useMapInteractionLock";
import { useRoute } from "@/hooks/useRoute.tsx";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MapIcon from "@mui/icons-material/Map";
import { Box, IconButton, Typography, useMediaQuery } from "@mui/material";
import type { FeatureCollection } from "geojson";

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** Below this width the page becomes details-first with a tappable map preview. */
const MOBILE_MAX_WIDTH = 860;
const HEADER_HEIGHT = 64;
const PAGE_HEIGHT = `calc(100vh - ${HEADER_HEIGHT}px)`;

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

type RouteItem = NonNullable<ReturnType<typeof useRoute>["data"]>;

interface RouteMapOverlaysProps {
  map: Map | null;
  view: MapView | SceneView | null;
  routeItem: RouteItem | undefined;
  error: Error | null;
  isLoading: boolean;
  isPreview: boolean;
  isAnimating: boolean;
  onPlayingChange: (isPlaying: boolean) => void;
}

/** Everything layered on top of the ESRI view for the route detail page. */
function RouteMapOverlays({
  map,
  view,
  routeItem,
  error,
  isLoading,
  isPreview,
  isAnimating,
  onPlayingChange,
}: RouteMapOverlaysProps) {
  const ready = map && view && !error && !isLoading && routeItem;

  return (
    <>
      {error && <div>Error loading route: {error.message}</div>}
      {isLoading && <div>Loading route...</div>}
      {ready && (
        <>
          <LayerController
            map={map}
            // @ts-expect-error value can be undefined
            layers={
              (routeItem.arcgis_item_id && [routeItem.arcgis_item_id]) ?? []
            }
            view={view}
          />
          <PhotoController map={map} photos={routeItem.photos || []} view={view} />
        </>
      )}
      {/* Kept mounted across preview/fullscreen toggles — unmounting would
          drop the animation layer and refetch the route GeoJSON. */}
      <Box sx={{ display: isPreview ? "none" : "contents" }}>
        {ready && <Toggle3d disabled={isAnimating} />}
        {map && view && (
          <RouteAnimationController
            map={map}
            view={view}
            arcgisItemId={routeItem?.arcgis_item_id}
            activityDurationSec={routeItem?.duration ?? null}
            onPlayingChange={onPlayingChange}
          />
        )}
      </Box>
    </>
  );
}

function RouteDetail() {
  const isMobile = useMediaQuery(`(max-width:${MOBILE_MAX_WIDTH - 0.05}px)`);
  const { routeId } = Route.useParams();

  const { data: routeItem, isLoading, error, isError } = useRoute(routeId);

  const [map, setMap] = useState<Map | null>(null);
  const [view, setView] = useState<MapView | SceneView | null>(null);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // The map preview and the fullscreen map are different places in the tree,
  // but they must share one ESRI view — recreating it on every toggle is slow.
  // So the map lives in a detached host div that gets re-parented into
  // whichever slot is currently rendered.
  const mapHost = useMemo(() => {
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.position = "relative";
    return host;
  }, []);

  const attachMapSlot = useCallback(
    (slot: HTMLDivElement | null) => {
      if (slot && mapHost.parentElement !== slot) {
        slot.appendChild(mapHost);
      }
    },
    [mapHost],
  );

  // Leaving mobile widths while fullscreen would otherwise strand the header.
  useEffect(() => {
    if (!isMobile) setIsFullscreenMap(false);
  }, [isMobile]);

  const isPreview = isMobile && !isFullscreenMap;
  useMapInteractionLock(view, isPreview || isAnimating);

  const handleMapLoad = (map: Map, view: MapView | SceneView) => {
    setMap(map);
    setView(view);
  };

  const handleMapReady = () => {};
  const handleMapUnload = () => {};
  const handleFail = (err: string) => {
    console.error(err);
  };

  const { profilePoints, hasElevation, onHover, onHoverEnd } =
    useElevationProfile(
      routeItem?.geojson as FeatureCollection | null | undefined,
      view,
    );

  const handleMapClick = (e: __esri.ViewClickEvent) => {
    const coords = `${
      Math.round((e.mapPoint?.latitude || 0) * 10000) / 10000
    }, ${Math.round((e.mapPoint?.longitude || 0) * 10000) / 10000}`;
    // eslint-disable-next-line no-console
    console.log(`Coordinates: ${coords} (${e.x},${e.y})`);
  };

  const mapTree = (
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
      <RouteMapOverlays
        map={map}
        view={view}
        routeItem={routeItem}
        error={isError ? error : null}
        isLoading={isLoading}
        isPreview={isPreview}
        isAnimating={isAnimating}
        onPlayingChange={setIsAnimating}
      />
    </MapContainer>
  );

  // While the animation plays the map is fully locked: gray out the ESRI
  // widgets, but leave our own overlays (the animation controls) live.
  const lockedMapSx = isAnimating
    ? { "& .esri-ui": { opacity: 0.45, pointerEvents: "none" } }
    : undefined;

  const mapSlot = (
    <Box sx={{ width: "100%", height: "100%", ...lockedMapSx }}>
      <div ref={attachMapSlot} style={{ width: "100%", height: "100%" }} />
    </Box>
  );

  const elevationSection = routeItem ? (
    <ElevationProfile
      profilePoints={profilePoints}
      hasElevation={hasElevation}
      onHover={onHover}
      onHoverEnd={onHoverEnd}
    />
  ) : null;

  const detailContent = (
    <>
      {isLoading && <RouteInfoSkeleton />}
      {routeItem && (
        <>
          <RouteInfoContainer routeItem={routeItem} />
          <Box sx={{ px: 2, pb: 1 }}>
            <PhotoGallery photos={routeItem.photos} />
          </Box>
        </>
      )}
    </>
  );

  return (
    <>
      {createPortal(mapTree, mapHost)}

      {isMobile && isFullscreenMap && (
        <Box
          sx={{
            height: PAGE_HEIGHT,
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.5,
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <IconButton
              aria-label="Back to route details"
              onClick={() => setIsFullscreenMap(false)}
              size="small"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {routeItem?.title ?? "Route"}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>{mapSlot}</Box>
        </Box>
      )}

      {isMobile && !isFullscreenMap && (
        <Box sx={{ width: "100%", height: PAGE_HEIGHT, overflowY: "auto" }}>
          {detailContent}
          <Box sx={{ px: 2, pb: 2 }}>
            <Box
              component="button"
              type="button"
              aria-label="Open fullscreen map"
              onClick={() => setIsFullscreenMap(true)}
              sx={{
                position: "relative",
                display: "block",
                width: "100%",
                height: 220,
                p: 0,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: "background.paper",
              }}
            >
              {mapSlot}
              {/* Swallows every pointer event so the preview reads as a
                  thumbnail rather than a live map. */}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "flex-end",
                  p: 1,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    bgcolor: "rgba(0,0,0,0.65)",
                    color: "white",
                    borderRadius: 2,
                    px: 1,
                    py: 0.25,
                  }}
                >
                  <MapIcon fontSize="small" />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    View map
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box sx={{ px: 2, pb: 2 }}>{elevationSection}</Box>
        </Box>
      )}

      {!isMobile && (
        <Box sx={{ display: "flex", height: PAGE_HEIGHT, width: "100%" }}>
          <Box
            sx={{
              flex: "1 1 66%",
              minWidth: 0,
              pr: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ flex: 1, minHeight: 0 }}>{mapSlot}</Box>
            <Box sx={{ flexShrink: 0, px: 2, py: 1 }}>{elevationSection}</Box>
          </Box>
          <Box
            sx={{
              flex: "0 0 34%",
              minWidth: 0,
              pl: 2,
              overflowY: "auto",
              height: PAGE_HEIGHT,
            }}
          >
            {detailContent}
          </Box>
        </Box>
      )}
    </>
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
