import { schemas } from "@/generatedtypes/django_generated";
import { dropboxShareUrlToDirectDownload } from "@/utils/dropboxImgHelpers";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  ImageList,
  ImageListItem,
  Typography,
} from "@mui/material";
import { useCallback, useEffect } from "react";
import type { z } from "zod";

type Photo = z.infer<typeof schemas.Photo>;

function resolveUrl(url: string): string {
  return dropboxShareUrlToDirectDownload(url) || url;
}

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, onClose, open, prev]);

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
    >
      <DialogContent
        sx={{
          position: "relative",
          p: 0,
          bgcolor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: "white",
            zIndex: 1,
            fontSize: 18,
          }}
          aria-label="Close"
        >
          ✕
        </IconButton>

        {photos.length > 1 && (
          <>
            <IconButton
              onClick={prev}
              sx={{
                position: "absolute",
                left: 8,
                color: "white",
                zIndex: 1,
                fontSize: 20,
              }}
              aria-label="Previous photo"
            >
              ‹
            </IconButton>
            <IconButton
              onClick={next}
              sx={{
                position: "absolute",
                right: 48,
                color: "white",
                zIndex: 1,
                fontSize: 20,
              }}
              aria-label="Next photo"
            >
              ›
            </IconButton>
          </>
        )}

        <Box sx={{ width: "100%", textAlign: "center", p: 1 }}>
          <img
            src={resolveUrl(current.url)}
            alt={current.title ?? `Photo ${index + 1}`}
            style={{
              maxWidth: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
            }}
          />
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
            sx={{ cursor: "pointer", overflow: "hidden", borderRadius: 1 }}
            onClick={() => onPhotoClick(i)}
          >
            <img
              src={resolveUrl(photo.url)}
              alt={photo.title ?? `Photo ${i + 1}`}
              loading="lazy"
              style={{
                width: "100%",
                height: 80,
                objectFit: "cover",
                display: "block",
              }}
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
}
