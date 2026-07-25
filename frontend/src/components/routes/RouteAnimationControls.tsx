import AnimationSettingsPopover from "@/components/AnimationSettingsPopover";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { Box, IconButton, LinearProgress, Tooltip } from "@mui/material";

interface RouteAnimationControlsProps {
  arcgisItemId?: string | null;
  isPlaying: boolean;
  progress: number;
  pointCount: number | null;
  pointsPerSecond: number;
  playbackMode: "indexed" | "distance";
  activityDurationSec: number | null;
  onPlay: () => void;
  onStop: () => void;
  onSpeedChange: (pps: number) => void;
  onPlaybackModeChange: (mode: "indexed" | "distance") => void;
}

export function RouteAnimationControls({
  arcgisItemId,
  isPlaying,
  progress,
  pointCount,
  pointsPerSecond,
  playbackMode,
  activityDurationSec,
  onPlay,
  onStop,
  onSpeedChange,
  onPlaybackModeChange,
}: RouteAnimationControlsProps) {
  if (!arcgisItemId) return null;

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
      <Tooltip title={isPlaying ? "Stop" : "Replay route"}>
        <IconButton
          size="small"
          onClick={isPlaying ? onStop : onPlay}
          sx={{ color: "white" }}
        >
          {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>
      <LinearProgress
        variant="determinate"
        value={progress * 100}
        sx={{ flex: 1, borderRadius: 1, height: 6 }}
      />
      <AnimationSettingsPopover
        pointsPerSecond={pointsPerSecond}
        pointCount={pointCount}
        playbackMode={playbackMode}
        activityDurationSec={activityDurationSec}
        onSpeedChange={onSpeedChange}
        onPlaybackModeChange={onPlaybackModeChange}
      />
    </Box>
  );
}
