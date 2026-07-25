import SettingsIcon from "@mui/icons-material/Settings";
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";

const SPEED_OPTIONS = [10, 50, 100, 200, 500] as const;

type AnimationPlaybackMode = "indexed" | "distance";

interface Props {
  pointsPerSecond: number;
  pointCount: number | null;
  playbackMode: AnimationPlaybackMode;
  /** Activity duration in seconds from the route record */
  activityDurationSec: number | null | undefined;
  onSpeedChange: (pps: number) => void;
  onPlaybackModeChange: (mode: AnimationPlaybackMode) => void;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AnimationSettingsPopover({
  pointsPerSecond,
  pointCount,
  playbackMode,
  activityDurationSec,
  onSpeedChange,
  onPlaybackModeChange,
}: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const estimatedSec =
    pointCount != null ? Math.round(pointCount / pointsPerSecond) : null;

  return (
    <>
      <Tooltip title="Playback settings">
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ color: "white" }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Stack sx={{ p: 2, minWidth: "calc('100vW' / 2)" }} spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel id="speed-label">Speed</InputLabel>
            <Select
              labelId="speed-label"
              label="Speed"
              value={pointsPerSecond}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
            >
              {SPEED_OPTIONS.map((v) => (
                <MenuItem key={v} value={v}>
                  {v} pts/sec
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="playback-mode-label">Mode</InputLabel>
            <Select
              labelId="playback-mode-label"
              label="Mode"
              value={playbackMode}
              onChange={(e) =>
                onPlaybackModeChange(e.target.value as AnimationPlaybackMode)
              }
            >
              <MenuItem value="indexed">By GPS points</MenuItem>
              <MenuItem value="distance">Constant speed</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            Playback:{" "}
            {estimatedSec != null ? `~${estimatedSec}s` : "calculating…"}
          </Typography>
          {activityDurationSec != null && (
            <Typography variant="caption" color="text.secondary">
              Actual activity: {formatDuration(activityDurationSec)}
            </Typography>
          )}
        </Stack>
      </Popover>
    </>
  );
}
