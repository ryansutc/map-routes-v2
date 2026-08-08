import {
  TARGET_ROUTE_DURATIONS_SEC,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Collapse,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface Props {
  targetDurationSec: TargetRouteDurationSec;
  playbackMode: RoutePlaybackMode;
  availablePlaybackModes: readonly RoutePlaybackMode[];
  timestampCapable: boolean;
  skipDetectedStops: boolean;
  showTimedPhotos: boolean;
  /** Activity duration in seconds from the route record. */
  activityDurationSec: number | null | undefined;
  onDurationChange: (duration: TargetRouteDurationSec) => void;
  onPlaybackModeChange: (mode: RoutePlaybackMode) => void;
  onSkipDetectedStopsChange: (skip: boolean) => void;
  onShowTimedPhotosChange: (show: boolean) => void;
}

const MODE_LABELS: Record<RoutePlaybackMode, string> = {
  recorded: "Recorded time",
  indexed: "By GPS points",
  distance: "Constant speed",
};

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AnimationSettingsPopover({
  targetDurationSec,
  playbackMode,
  availablePlaybackModes,
  timestampCapable,
  skipDetectedStops,
  showTimedPhotos,
  activityDurationSec,
  onDurationChange,
  onPlaybackModeChange,
  onSkipDetectedStopsChange,
  onShowTimedPhotosChange,
}: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  return (
    <>
      <Tooltip title="Playback settings">
        <IconButton
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
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
        <Stack sx={{ p: 2, minWidth: 240 }} spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel id="duration-label">Route duration</InputLabel>
            <Select
              labelId="duration-label"
              label="Route duration"
              value={targetDurationSec}
              onChange={(event) =>
                onDurationChange(event.target.value as TargetRouteDurationSec)
              }
            >
              {TARGET_ROUTE_DURATIONS_SEC.map((duration) => (
                <MenuItem key={duration} value={duration}>
                  {duration} seconds
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={skipDetectedStops}
                  disabled={!timestampCapable || playbackMode !== "recorded"}
                  onChange={(event) =>
                    onSkipDetectedStopsChange(event.target.checked)
                  }
                />
              }
              label="Skip detected stops"
            />
            <Collapse
              in={!timestampCapable || playbackMode !== "recorded"}
              unmountOnExit
            >
              <FormHelperText>
                {timestampCapable
                  ? "Only applies to recorded-time playback."
                  : "Recorded point timestamps are unavailable for this route."}
              </FormHelperText>
            </Collapse>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={showTimedPhotos}
                  disabled={!timestampCapable}
                  onChange={(event) =>
                    onShowTimedPhotosChange(event.target.checked)
                  }
                />
              }
              label="Show timed photos"
            />
            <Collapse in={!timestampCapable} unmountOnExit>
              <FormHelperText>
                Recorded point timestamps are unavailable for this route.
              </FormHelperText>
            </Collapse>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="playback-mode-label">Mode</InputLabel>
            <Select
              labelId="playback-mode-label"
              label="Mode"
              value={playbackMode}
              onChange={(event) =>
                onPlaybackModeChange(event.target.value as RoutePlaybackMode)
              }
            >
              {availablePlaybackModes.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            Route playback: {targetDurationSec} seconds
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
