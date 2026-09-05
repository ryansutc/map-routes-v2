import type { AutomaticPhotoPresentation } from "@/domain/timedPhotoPlayback";
import type { PhotoMapAnchor, PhotoMapAnchorSnapshot } from "@/domain/photoMapAnchor";
import { resolvePhotoUrl } from "@/utils/dropboxImgHelpers";
import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Paper, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANIMATION_CONTROLS_RESERVED_HEIGHT_PX } from "./mapOverlayLayout";

const DESKTOP_POPUP_WIDTH = 240;
const MOBILE_POPUP_WIDTH = 180;
const MOBILE_VIEWPORT_MAX_WIDTH = 600;
const POPUP_MARGIN = 8;
const ANCHOR_GAP = 12;

type PopupPlacement = {
  left: number;
  top: number;
  width: number;
  side: "above" | "below";
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function placePhotoPopup(
  anchor: PhotoMapAnchorSnapshot,
  hasTitle: boolean,
): PopupPlacement {
  const width =
    anchor.viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH
      ? MOBILE_POPUP_WIDTH
      : DESKTOP_POPUP_WIDTH;
  const height = width * 0.75 + (hasTitle ? 36 : 0);
  const side =
    anchor.y - ANCHOR_GAP - height >= POPUP_MARGIN ? "above" : "below";
  const preferredTop =
    side === "above"
      ? anchor.y - ANCHOR_GAP - height
      : anchor.y + ANCHOR_GAP;
  const clearControlsBottom = Math.max(
    POPUP_MARGIN,
    anchor.viewportHeight - ANIMATION_CONTROLS_RESERVED_HEIGHT_PX,
  );

  return {
    left: clamp(
      anchor.x - width / 2,
      POPUP_MARGIN,
      anchor.viewportWidth - width - POPUP_MARGIN,
    ),
    top: clamp(
      preferredTop,
      POPUP_MARGIN,
      clearControlsBottom - height,
    ),
    width,
    side,
  };
}

export function AutomaticPhotoPopup({
  photo,
  presentation,
  mapAnchor,
}: {
  photo: { id: number; url: string; title?: string | null };
  presentation: AutomaticPhotoPresentation;
  mapAnchor: PhotoMapAnchor;
}) {
  const [anchor, setAnchor] = useState(() =>
    mapAnchor.getSnapshot(photo.id),
  );
  const popupRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const timerPausedRef = useRef(false);

  useEffect(() => {
    const update = () => setAnchor(mapAnchor.getSnapshot(photo.id));
    update();
    return mapAnchor.subscribe(update);
  }, [mapAnchor, photo.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      presentation.onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [presentation]);

  const updateTimerPause = useCallback(() => {
    const paused = hoveredRef.current || focusedRef.current;
    if (timerPausedRef.current === paused) return;
    timerPausedRef.current = paused;
    presentation.onTimerPauseChange(paused);
  }, [presentation]);

  useEffect(() => {
    updateTimerPause();
    return () => {
      if (timerPausedRef.current) presentation.onTimerPauseChange(false);
      timerPausedRef.current = false;
    };
  }, [presentation, updateTimerPause]);

  if (!anchor) return null;
  const placement = placePhotoPopup(anchor, Boolean(photo.title));
  const expansionLabel = `Open ${photo.title ?? "photo"} in photo viewer`;

  return (
    <Paper
      ref={popupRef}
      role="dialog"
      aria-label="Automatic route photo"
      aria-modal="false"
      elevation={8}
      data-popup-width={placement.width}
      data-placement={placement.side}
      onMouseEnter={() => {
        hoveredRef.current = true;
        updateTimerPause();
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        updateTimerPause();
      }}
      onFocusCapture={() => {
        focusedRef.current = true;
        updateTimerPause();
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        focusedRef.current = false;
        updateTimerPause();
      }}
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.width,
      }}
      sx={{
        position: "absolute",
        zIndex: 11,
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
      <IconButton
        aria-label="Close photo popup"
        size="small"
        onClick={presentation.onDismiss}
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 1,
          color: "common.white",
          bgcolor: "rgba(0,0,0,0.6)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <Box
        component="button"
        type="button"
        aria-label={expansionLabel}
        onClick={() => presentation.onNavigate(photo.id)}
        sx={{
          display: "block",
          width: "100%",
          aspectRatio: "4 / 3",
          p: 0,
          border: 0,
          bgcolor: "common.black",
          cursor: "zoom-in",
        }}
      >
        <Box
          component="img"
          src={resolvePhotoUrl(photo.url)}
          alt={photo.title ?? "Route photo"}
          onLoad={presentation.onLoad}
          onError={presentation.onError}
          sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </Box>
      {photo.title && (
        <Typography variant="caption" component="p" noWrap sx={{ px: 1, py: 0.75, m: 0 }}>
          {photo.title}
        </Typography>
      )}
    </Paper>
  );
}
