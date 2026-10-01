import { useSettingsDialog } from "@/components/settings/SettingsDialog";
import {
  ANIMATION_CONTROLS_BOTTOM_PX,
  ANIMATION_CONTROLS_COLLISION_BREAKPOINT_PX,
  ANIMATION_CONTROLS_HEIGHT_PX,
  ANIMATION_CONTROLS_MAX_WIDTH_PX,
  ANIMATION_CONTROLS_MIN_LEFT_PX,
  BASEMAP_CONTROL_LEFT_PX,
} from "@/components/map/mapOverlayLayout";
import {
  isAnimationSessionActive,
  type AnimationLifecycleState,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SettingsIcon from "@mui/icons-material/Settings";
import StopIcon from "@mui/icons-material/Stop";
import {
  Box,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import type { RefObject } from "react";

interface RouteAnimationControlsProps {
  state: AnimationLifecycleState;
  playbackProgress: number;
  pointCount: number;
  targetDurationSec: TargetRouteDurationSec;
  onPlay: () => void;
  onStop: () => void;
  completionPresentationActive?: boolean;
  replayButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function RouteAnimationControls({
  state,
  playbackProgress,
  pointCount,
  targetDurationSec,
  onPlay,
  onStop,
  completionPresentationActive = false,
  replayButtonRef,
}: RouteAnimationControlsProps) {
  const { openSettings } = useSettingsDialog();
  if (pointCount < 2) return null;
  const isActive = isAnimationSessionActive(state);

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: ANIMATION_CONTROLS_BOTTOM_PX,
        height: ANIMATION_CONTROLS_HEIGHT_PX,
        boxSizing: "border-box",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "rgba(0,0,0,0.65)",
        borderRadius: 3,
        px: 2,
        py: 0.5,
        zIndex: 10,
        width: ANIMATION_CONTROLS_MAX_WIDTH_PX,
        maxWidth: ANIMATION_CONTROLS_MAX_WIDTH_PX,
        [`@media (max-width: ${ANIMATION_CONTROLS_COLLISION_BREAKPOINT_PX}px)`]: {
          left: ANIMATION_CONTROLS_MIN_LEFT_PX,
          right: BASEMAP_CONTROL_LEFT_PX,
          width: "auto",
          transform: "none",
        },
      }}
    >
      <Tooltip title={isActive ? "Stop" : "Replay route"}>
        <IconButton
          ref={replayButtonRef}
          size="small"
          onClick={isActive ? onStop : onPlay}
          disabled={completionPresentationActive}
          aria-label={isActive ? "Stop" : "Replay route"}
          sx={{ color: "white" }}
        >
          {isActive ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>
      <LinearProgress
        variant="determinate"
        value={playbackProgress * 100}
        sx={{ flex: 1, borderRadius: 1, height: 6 }}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ color: "white", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {targetDurationSec}s
        </Typography>
        <Tooltip title="Playback settings">
          <IconButton
            size="small"
            aria-label="Playback settings"
            onClick={() => openSettings("map-animation")}
            disabled={completionPresentationActive}
            sx={{ color: "white" }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
