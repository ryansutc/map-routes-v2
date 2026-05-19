import { zodiosAPI } from "@/api/axiosClient";
import { axiosInstance } from "@/api/axiosInstance";
import LayerController from "@/components/map/LayerController";
import MapContainer from "@/components/map/MapContainer";
import type { PhotoDto } from "@/types/api";
import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Map from "@arcgis/core/Map";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import UploadIcon from "@mui/icons-material/Upload";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { WizardState } from "./CreateRouteWizard";

type PhotoStatus = "pending" | "uploading" | "placed" | "no-gps" | "error";

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  title: string;
  lat?: number;
  lng?: number;
  errorMsg?: string;
};

type Props = {
  wizardState: WizardState;
  onBack: () => void;
};

const MAX_PHOTOS = 20;

async function uploadPhotoFile(routeId: number, file: File, title?: string): Promise<PhotoDto> {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  const res = await axiosInstance.post<PhotoDto>(
    `/api/route/${routeId}/photos/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export default function PhotoUploadStep({ wizardState, onBack }: Props) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [createdRouteId, setCreatedRouteId] = useState<number | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [view, setView] = useState<MapView | SceneView | null>(null);
  const photoLayerRef = useRef<GraphicsLayer | null>(null);

  const createRoute = useMutation({
    mutationFn: () => {
      const p = wizardState.parsed!;
      return zodiosAPI.route_create({
        title: wizardState.title,
        activity_date: p.date,
        activity_type: wizardState.activityType || null,
        distance: p.distance_m,
        duration: p.duration_s ?? undefined,
        avg_pace:
          p.avg_pace_decimal != null
            ? p.avg_pace_decimal.toFixed(2)
            : undefined,
        elevation_gain:
          p.elevation_gain_m != null
            ? p.elevation_gain_m.toFixed(2)
            : undefined,
        arcgis_item_id: p.arcgis_item_id,
        geojson: p.geojson,
        notes: wizardState.notes || undefined,
        is_public: wizardState.isPublic,
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setQueue((prev) => {
      const remaining = MAX_PHOTOS - prev.length;
      const toAdd = acceptedFiles.slice(0, remaining).map((file) => ({
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending" as PhotoStatus,
        title: "",
      }));
      return [...prev, ...toAdd];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: MAX_PHOTOS,
    disabled: isPublishing,
  });

  const handleMapLoad = (m: Map, v: MapView | SceneView) => {
    setMap(m);
    setView(v);
    const layer = new GraphicsLayer({ id: "wizard-photos" });
    m.add(layer);
    photoLayerRef.current = layer;
  };

  const addPhotoPin = (lat: number, lng: number) => {
    if (!photoLayerRef.current) return;
    photoLayerRef.current.add(
      new Graphic({
        geometry: new Point({ longitude: lng, latitude: lat }),
        symbol: new SimpleMarkerSymbol({
          color: [226, 119, 40],
          size: 8,
          outline: { color: [255, 255, 255], width: 1 },
        }),
      }),
    );
  };

  const retryItem = async (id: string) => {
    if (!createdRouteId) return;
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "uploading", errorMsg: undefined } : q)),
    );
    try {
      const photo = await uploadPhotoFile(createdRouteId, item.file, item.title || undefined);
      const hasGps = photo.has_gps;
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, status: hasGps ? "placed" : "no-gps", lat: photo.latitude ?? undefined, lng: photo.longitude ?? undefined }
            : q,
        ),
      );
      if (hasGps && photo.latitude != null && photo.longitude != null) {
        addPhotoPin(photo.latitude, photo.longitude);
      }
    } catch (err) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, status: "error", errorMsg: (err as Error)?.message ?? "Upload failed" }
            : q,
        ),
      );
    }
  };

  const removeItem = (id: string) => {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.id !== id);
    });
  };

  const setItemTitle = (id: string, title: string) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, title } : q)));
  };

  const handlePublish = async () => {
    if (!wizardState.parsed) return;
    setPublishError(null);
    setIsPublishing(true);

    let routeId: number;
    try {
      const route = await createRoute.mutateAsync();
      routeId = route.id;
      setCreatedRouteId(routeId);
    } catch (err) {
      setPublishError((err as Error)?.message ?? "Failed to create route");
      setIsPublishing(false);
      return;
    }

    // Upload photos sequentially
    for (const item of queue) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading" } : q)),
      );
      try {
        const photo = await uploadPhotoFile(routeId, item.file, item.title || undefined);
        const hasGps = photo.has_gps;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: hasGps ? "placed" : "no-gps",
                  lat: photo.latitude ?? undefined,
                  lng: photo.longitude ?? undefined,
                }
              : q,
          ),
        );
        if (hasGps && photo.latitude != null && photo.longitude != null) {
          addPhotoPin(photo.latitude, photo.longitude);
        }
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMsg: (err as Error)?.message ?? "Upload failed",
                }
              : q,
          ),
        );
      }
    }

    void navigate({ to: "/routes/$routeId", params: { routeId: routeId } });
  };

  const statusChip = (item: QueueItem) => {
    switch (item.status) {
      case "pending":
        return <Chip label="Pending" size="small" />;
      case "uploading":
        return (
          <Chip
            icon={<CircularProgress size={12} />}
            label="Uploading"
            size="small"
            color="primary"
          />
        );
      case "placed":
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Placed"
            size="small"
            color="success"
          />
        );
      case "no-gps":
        return (
          <Chip
            icon={<HelpOutlineIcon />}
            label="No GPS"
            size="small"
            color="warning"
          />
        );
      case "error":
        return (
          <Chip
            icon={<ErrorOutlineIcon />}
            label="Error"
            size="small"
            color="error"
          />
        );
    }
  };

  const arcgisItemId = wizardState.parsed?.arcgis_item_id;
  const canPublish = !isPublishing;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Left panel */}
      <Box
        sx={{
          flex: "0 0 340px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Add Photos (optional)
        </Typography>

        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "divider",
            borderRadius: 2,
            p: 3,
            textAlign: "center",
            cursor: isPublishing ? "not-allowed" : "pointer",
            bgcolor: isDragActive ? "action.hover" : "background.paper",
            transition: "border-color 0.2s, background-color 0.2s",
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 32, color: "text.secondary", mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {isDragActive
              ? "Drop images here"
              : `Drag & drop images, or click to select (max ${MAX_PHOTOS})`}
          </Typography>
          {queue.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mt={0.5}
            >
              {queue.length} / {MAX_PHOTOS} photos added
            </Typography>
          )}
        </Box>

        {queue.length > 0 && (
          <>
            <Divider />
            <List
              dense
              disablePadding
              sx={{ maxHeight: 280, overflowY: "auto" }}
            >
              {queue.map((item) => (
                <ListItem
                  key={item.id}
                  disableGutters
                  secondaryAction={
                    item.status === "pending" && !isPublishing ? (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => removeItem(item.id)}
                        sx={{ minWidth: 0, fontSize: "0.7rem" }}
                      >
                        Remove
                      </Button>
                    ) : item.status === "error" && createdRouteId ? (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => void retryItem(item.id)}
                        sx={{ minWidth: 0, fontSize: "0.7rem" }}
                      >
                        Retry
                      </Button>
                    ) : undefined
                  }
                >
                  <Box
                    component="img"
                    src={item.previewUrl}
                    sx={{
                      width: 40,
                      height: 40,
                      objectFit: "cover",
                      borderRadius: 1,
                      mr: 1,
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>{item.file.name}</Typography>
                    {item.status === "pending" && !isPublishing && (
                      <TextField
                        size="small"
                        variant="standard"
                        placeholder="Add a title…"
                        value={item.title}
                        onChange={(e) => setItemTitle(item.id, e.target.value)}
                        slotProps={{ input: { maxLength: 255 } }}
                        sx={{ width: "100%", mt: 0.25 }}
                      />
                    )}
                    <Box sx={{ mt: 0.25 }}>{statusChip(item)}</Box>
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {publishError && (
          <Alert severity="error" onClose={() => setPublishError(null)}>
            {publishError}
          </Alert>
        )}

        <Stack
          direction="row"
          spacing={1}
          justifyContent="space-between"
          sx={{ mt: "auto", pt: 1 }}
        >
          <Button variant="outlined" onClick={onBack} disabled={isPublishing}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={() => void handlePublish()}
            disabled={!canPublish}
            startIcon={
              isPublishing ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {isPublishing ? "Publishing…" : "Publish Route"}
          </Button>
        </Stack>
      </Box>

      {/* Right panel: map */}
      <Box sx={{ flex: 1, minHeight: 400, position: "relative" }}>
        <div
          id="wizardMapDiv"
          style={{ width: "100%", height: "100%", minHeight: 400 }}
        >
          <MapContainer
            attachToId="wizardMapDiv"
            mapProperties={{ basemap: "satellite" }}
            viewProperties={{ center: [-122.55, 49.3], zoom: 6 }}
            onClick={() => {}}
            onFail={(err) => console.error(err)}
            onLoad={handleMapLoad}
            onReady={() => {}}
            onUnload={() => {}}
          >
            {map && view && arcgisItemId && (
              <LayerController map={map} view={view} layers={[arcgisItemId]} />
            )}
          </MapContainer>
        </div>
      </Box>
    </Box>
  );
}
