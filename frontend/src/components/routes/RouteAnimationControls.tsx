import { useSettingsDialog } from "@/components/settings/SettingsDialog";
import {
  ANIMATION_CONTROLS_BOTTOM_PX,
  ANIMATION_CONTROLS_HEIGHT_PX,
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

interface RouteAnimationControlsProps {
  state: AnimationLifecycleState;
  playbackProgress: number;
  pointCount: number;
  targetDurationSec: TargetRouteDurationSec;
  onPlay: () => void;
  onStop: () => void;
}

export function RouteAnimationControls({
  state,
  playbackProgress,
  pointCount,
  targetDurationSec,
  onPlay,
  onStop,
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
        minWidth: 300,
      }}
    >
      <Tooltip title={isActive ? "Stop" : "Replay route"}>
        <IconButton
          size="small"
          onClick={isActive ? onStop : onPlay}
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
            sx={{ color: "white" }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
