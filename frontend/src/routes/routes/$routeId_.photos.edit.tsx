import { zodiosAPI } from "@/api/axiosClient";
import { axiosInstance } from "@/api/axiosInstance";
import { routeQueryKey, useRoute } from "@/hooks/useRoute";
import { useToast } from "@/hooks/useToast";
import { useStore } from "@/state/store";
import type { PhotoDto } from "@/types/api";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadIcon from "@mui/icons-material/Upload";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

export const Route = createFileRoute("/routes/$routeId_/photos/edit")({
  parseParams: ({ routeId }) => {
    const parsed = Number.parseInt(routeId, 10);
    if (Number.isNaN(parsed)) throw new Error("Invalid route id");
    return { routeId: parsed };
  },
  stringifyParams: ({ routeId }) => ({ routeId: String(routeId) }),
  component: PhotoEditor,
});

const MAX_PHOTOS = 20;

type QueuedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  status: "queued" | "uploading" | "error";
  error?: string;
};

async function uploadPhoto(routeId: number, queued: QueuedPhoto): Promise<PhotoDto> {
  const formData = new FormData();
  formData.append("file", queued.file);
  if (queued.title.trim()) formData.append("title", queued.title.trim());
  const response = await axiosInstance.post<PhotoDto>(
    `/api/route/${routeId}/photos/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

function PhotoEditor() {
  const { routeId } = Route.useParams();
  const { data: route, isLoading, error } = useRoute(routeId);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar, enqueueError } = useToast();
  const allowNavigationRef = useRef(false);
  const redirectedRef = useRef(false);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const queueRef = useRef<QueuedPhoto[]>([]);
  const [titleDrafts, setTitleDrafts] = useState<Record<number, string>>({});
  const [busyPhotoId, setBusyPhotoId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!route) return;
    setTitleDrafts((current) => {
      const next = { ...current };
      route.photos.forEach((photo) => {
        if (!(photo.id in next)) next[photo.id] = photo.title ?? "";
      });
      return next;
    });
  }, [route]);

  useEffect(() => {
    if (!route || !user || route.owner === user || redirectedRef.current) return;
    redirectedRef.current = true;
    enqueueError("Only the route owner can edit this route.");
    void navigate({ to: "/routes/$routeId", params: { routeId }, replace: true });
  }, [enqueueError, navigate, route, routeId, user]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(
    () => () => {
      queueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const hasDirtyTitle = useMemo(
    () =>
      Boolean(
        route?.photos.some(
          (photo) => (titleDrafts[photo.id] ?? "") !== (photo.title ?? ""),
        ),
      ),
    [route, titleDrafts],
  );
  const hasUnsavedWork = queue.length > 0 || hasDirtyTitle;

  useBlocker({
    shouldBlockFn: () => {
      if (allowNavigationRef.current) return false;
      return !window.confirm("Leave without uploading or saving your photo changes?");
    },
    enableBeforeUnload: hasUnsavedWork,
    disabled: !hasUnsavedWork,
  });

  const remainingCapacity = Math.max(0, MAX_PHOTOS - (route?.photos.length ?? 0) - queue.length);
  const onDrop = useCallback(
    (files: File[]) => {
      const selected = files.slice(0, remainingCapacity).map((file) => ({
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        title: "",
        status: "queued" as const,
      }));
      setQueue((current) => [...current, ...selected]);
    },
    [remainingCapacity],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: remainingCapacity,
    disabled: uploading || remainingCapacity === 0,
  });

  const refreshRoute = async () => {
    await queryClient.invalidateQueries({ queryKey: routeQueryKey(routeId) });
    await queryClient.invalidateQueries({ queryKey: ["routes"] });
  };

  const saveTitle = async (photo: PhotoDto) => {
    const title = (titleDrafts[photo.id] ?? "").trim();
    setBusyPhotoId(photo.id);
    setPageError(null);
    try {
      await zodiosAPI.route_photos_partial_update(
        { title },
        { params: { id: routeId, photo_pk: photo.id } },
      );
      setTitleDrafts((current) => ({ ...current, [photo.id]: title }));
      await refreshRoute();
      enqueueSnackbar("Photo title saved", "success");
    } catch (mutationError) {
      setPageError((mutationError as Error).message || "Could not save the photo title.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const deleteExistingPhoto = async (photo: PhotoDto) => {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    setBusyPhotoId(photo.id);
    setPageError(null);
    try {
      await zodiosAPI.route_photos_destroy(undefined, {
        params: { id: routeId, photo_pk: photo.id },
      });
      await refreshRoute();
      enqueueSnackbar("Photo deleted", "success");
    } catch (mutationError) {
      setPageError((mutationError as Error).message || "Could not delete the photo.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const removeQueuedPhoto = (id: string) => {
    setQueue((current) => {
      const item = current.find((queued) => queued.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((queued) => queued.id !== id);
    });
  };

  const uploadQueuedPhotos = async () => {
    setUploading(true);
    setPageError(null);
    for (const item of queue) {
      setQueue((current) =>
        current.map((queued) =>
          queued.id === item.id ? { ...queued, status: "uploading", error: undefined } : queued,
        ),
      );
      try {
        await uploadPhoto(routeId, item);
        URL.revokeObjectURL(item.previewUrl);
        setQueue((current) => current.filter((queued) => queued.id !== item.id));
      } catch (uploadError) {
        setQueue((current) =>
          current.map((queued) =>
            queued.id === item.id
              ? {
                  ...queued,
                  status: "error",
                  error: (uploadError as Error).message || "Upload failed.",
                }
              : queued,
          ),
        );
      }
    }
    await refreshRoute();
    setUploading(false);
  };

  const handleDone = () => {
    if (
      hasUnsavedWork &&
      !window.confirm("Leave without uploading or saving your photo changes?")
    ) {
      return;
    }
    allowNavigationRef.current = true;
    void navigate({ to: "/routes/$routeId", params: { routeId } });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress aria-label="Loading photo editor" />
      </Box>
    );
  }
  if (error) return <Alert severity="error">Could not load this route: {error.message}</Alert>;
  if (!route || route.owner !== user) return null;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleDone} sx={{ mb: 2 }}>
        Back to route
      </Button>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Edit photos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {route.photos.length} / {MAX_PHOTOS} photos uploaded
          </Typography>
        </Box>
        <Button variant="contained" onClick={handleDone}>
          Done
        </Button>
      </Stack>

      {pageError && (
        <Alert severity="error" onClose={() => setPageError(null)} sx={{ mb: 2 }}>
          {pageError}
        </Alert>
      )}

      <Paper
        {...getRootProps()}
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          textAlign: "center",
          borderStyle: "dashed",
          cursor: remainingCapacity > 0 && !uploading ? "pointer" : "not-allowed",
          bgcolor: isDragActive ? "action.hover" : "background.paper",
        }}
      >
        <input {...getInputProps()} />
        <UploadIcon color="action" />
        <Typography variant="body2" color="text.secondary">
          {remainingCapacity === 0
            ? "This route has reached the 20-photo limit."
            : `Drag and drop images, or click to select (${remainingCapacity} available)`}
        </Typography>
      </Paper>

      {queue.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Ready to upload ({queue.length})</Typography>
            <Button
              variant="contained"
              startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
              onClick={() => void uploadQueuedPhotos()}
              disabled={uploading}
            >
              Upload
            </Button>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 2,
            }}
          >
            {queue.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                <Box
                  component="img"
                  src={item.previewUrl}
                  alt={item.file.name}
                  sx={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 1 }}
                />
                <TextField
                  label="Title (optional)"
                  value={item.title}
                  onChange={(event) =>
                    setQueue((current) =>
                      current.map((queued) =>
                        queued.id === item.id
                          ? { ...queued, title: event.target.value }
                          : queued,
                      ),
                    )
                  }
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  disabled={item.status === "uploading"}
                />
                <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                  <Chip
                    size="small"
                    label={
                      item.status === "uploading"
                        ? "Uploading"
                        : item.status === "error"
                          ? "Upload failed"
                          : "Queued"
                    }
                    color={item.status === "error" ? "error" : "default"}
                  />
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => removeQueuedPhoto(item.id)}
                    disabled={item.status === "uploading"}
                  >
                    Remove
                  </Button>
                </Stack>
                {item.error && (
                  <Typography variant="caption" color="error">
                    {item.error}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Existing photos
      </Typography>
      {!route.photos.length ? (
        <Typography color="text.secondary">No photos added.</Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 2,
          }}
        >
          {route.photos.map((photo) => {
            const draft = titleDrafts[photo.id] ?? "";
            const titleDirty = draft !== (photo.title ?? "");
            const busy = busyPhotoId === photo.id;
            return (
              <Paper key={photo.id} variant="outlined" sx={{ p: 1.5 }}>
                <Box
                  component="img"
                  src={photo.url}
                  alt={photo.title || "Route photo"}
                  sx={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 1 }}
                />
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                  <Chip
                    size="small"
                    label={photo.has_gps ? "GPS available" : "No GPS"}
                    color={photo.has_gps ? "success" : "default"}
                    variant="outlined"
                  />
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Delete photo">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => void deleteExistingPhoto(photo)}
                        disabled={busy}
                        aria-label="Delete photo"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <TextField
                  label="Title (optional)"
                  value={draft}
                  onChange={(event) =>
                    setTitleDrafts((current) => ({
                      ...current,
                      [photo.id]: event.target.value,
                    }))
                  }
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  disabled={busy}
                />
                <Button
                  size="small"
                  onClick={() => void saveTitle(photo)}
                  disabled={!titleDirty || busy}
                  sx={{ mt: 1 }}
                >
                  {busy ? "Saving…" : "Save title"}
                </Button>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
