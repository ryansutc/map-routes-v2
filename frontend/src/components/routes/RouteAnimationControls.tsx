import AnimationSettingsPopover from "@/components/AnimationSettingsPopover";
import {
  isAnimationSessionActive,
  type AnimationLifecycleState,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
  playbackMode: RoutePlaybackMode;
  availablePlaybackModes: readonly RoutePlaybackMode[];
  activityDurationSec: number | null;
  onPlay: () => void;
  onStop: () => void;
  onDurationChange: (duration: TargetRouteDurationSec) => void;
  onPlaybackModeChange: (mode: RoutePlaybackMode) => void;
}

export function RouteAnimationControls({
  state,
  playbackProgress,
  pointCount,
  targetDurationSec,
  playbackMode,
  availablePlaybackModes,
  activityDurationSec,
  onPlay,
  onStop,
  onDurationChange,
  onPlaybackModeChange,
}: RouteAnimationControlsProps) {
  if (pointCount < 2) return null;
  const isActive = isAnimationSessionActive(state);

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 24,
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
        minWidth: 200,
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
        <AnimationSettingsPopover
          targetDurationSec={targetDurationSec}
          playbackMode={playbackMode}
          availablePlaybackModes={availablePlaybackModes}
          activityDurationSec={activityDurationSec}
          onDurationChange={onDurationChange}
          onPlaybackModeChange={onPlaybackModeChange}
        />
      </Box>
    </Box>
  );
}
