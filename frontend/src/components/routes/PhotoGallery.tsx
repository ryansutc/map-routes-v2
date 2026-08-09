import { schemas } from "@/generatedtypes/django_generated";
import { resolvePhotoUrl } from "@/utils/dropboxImgHelpers";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  ImageList,
  ImageListItem,
  Typography,
} from "@mui/material";
import { useCallback } from "react";
import type { z } from "zod";

type Photo = z.infer<typeof schemas.Photo>;

const navigationButtonSx = {
  position: "absolute",
  color: "white",
  bgcolor: "rgba(0,0,0,0.45)",
  zIndex: 2,
  fontSize: 20,
  "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
} as const;

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  onImageLoad,
  onImageError,
  onStopPlayback,
  navigationEnabled = true,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onImageLoad?: () => void;
  onImageError?: () => void;
  onStopPlayback?: () => void;
  navigationEnabled?: boolean;
}) {
  const open = index !== null && photos.length > 0;

  const prev = useCallback(
    () => onIndexChange(((index ?? 0) - 1 + photos.length) % photos.length),
    [index, onIndexChange, photos.length],
  );
  const next = useCallback(
    () => onIndexChange(((index ?? 0) + 1) % photos.length),
    [index, onIndexChange, photos.length],
  );

  if (!open || index === null) return null;
  const current = photos[index];
  if (!current) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-label="Photo lightbox"
      onKeyDown={(event) => {
        if (!navigationEnabled) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          prev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
      }}
      slotProps={{
        paper: {
          sx: {
            m: { xs: 0, sm: 4 },
            width: { xs: "100%", sm: "calc(100% - 64px)" },
            height: { xs: "100%", sm: "auto" },
            maxHeight: { xs: "100%", sm: "calc(100% - 64px)" },
          },
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          bgcolor: "black",
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: 0, sm: 400 },
          height: { xs: "100%", sm: "auto" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            p: 1,
            flexShrink: 0,
          }}
        >
          {onStopPlayback ? (
            <Button
              onClick={onStopPlayback}
              size="small"
              variant="contained"
              color="error"
            >
              Stop playback
            </Button>
          ) : (
            <Box />
          )}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: "white", fontSize: 18 }}
            aria-label="Close"
          >
            ✕
          </IconButton>
        </Box>

        <Box
          sx={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {navigationEnabled && photos.length > 1 && (
            <IconButton
              onClick={prev}
              sx={{
                ...navigationButtonSx,
                left: 8,
              }}
              aria-label="Previous photo"
            >
              ‹
            </IconButton>
          )}
          <Box
            component="img"
            key={current.id}
            src={resolvePhotoUrl(current.url)}
            alt={current.title ?? `Photo ${index + 1}`}
            onLoad={onImageLoad}
            onError={onImageError}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: { xs: "100%", sm: "80vh" },
              objectFit: "contain",
            }}
          />
          {navigationEnabled && photos.length > 1 && (
            <IconButton
              onClick={next}
              sx={{
                ...navigationButtonSx,
                right: 8,
              }}
              aria-label="Next photo"
            >
              ›
            </IconButton>
          )}
        </Box>

        <Box sx={{ width: "100%", textAlign: "center", px: 1, pb: 1 }}>
          {current.title && (
            <Typography
              variant="caption"
              sx={{ color: "grey.400", display: "block", mt: 1 }}
            >
              {current.title}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "grey.600" }}>
            {index + 1} / {photos.length}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default function PhotoGallery({
  photos,
  onPhotoClick,
}: {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
}) {
  if (!photos.length) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Photos ({photos.length})
      </Typography>
      <ImageList cols={3} gap={4} sx={{ m: 0 }}>
        {photos.map((photo, i) => (
          <ImageListItem
            key={photo.id}
            sx={{ overflow: "hidden", borderRadius: 1 }}
          >
            <Box
              component="button"
              type="button"
              aria-label={`Open ${photo.title ?? `photo ${i + 1}`}`}
              onClick={() => onPhotoClick(i)}
              sx={{
                display: "block",
                width: "100%",
                height: "100%",
                p: 0,
                border: 0,
                cursor: "pointer",
                bgcolor: "transparent",
              }}
            >
              <img
                src={resolvePhotoUrl(photo.url)}
                alt={photo.title ?? `Photo ${i + 1}`}
                loading="lazy"
                style={{
                  width: "100%",
                  height: 80,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </Box>
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
}
