import {
  TARGET_ROUTE_DURATIONS_SEC,
  type RoutePlaybackMode,
  type TargetRouteDurationSec,
} from "@/domain/routeAnimation";
import { useStore } from "@/state/store";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";

const PLAYBACK_MODES: readonly RoutePlaybackMode[] = [
  "recorded",
  "indexed",
  "distance",
];

const MODE_LABELS: Record<RoutePlaybackMode, string> = {
  recorded: "Recorded time",
  indexed: "By GPS points",
  distance: "Constant speed",
};

export type MapAnimationRouteContext = Readonly<{
  availablePlaybackModes: readonly RoutePlaybackMode[];
  effectivePlaybackMode: RoutePlaybackMode;
  timestampCapable: boolean;
  animationSettingsDisabled?: boolean;
}>;

interface MapAnimationSettingsProps {
  routeContext: MapAnimationRouteContext | null;
}

const playbackDescription = {
  recorded:
    "Speed follows recorded timestamps to preserve changes in travel speed. ",
  indexed:
    "Marches through GPS points at an even rate, regardless of the time or distance between them. ",
  distance:
    "Steadily moves along the route, regardless of individual track points. Smooth but does not reflect travel speed. ",
};

export function MapAnimationSettings({
  routeContext,
}: MapAnimationSettingsProps) {
  const targetDurationSec = useStore((state) => state.animationDurationSec);
  const setTargetDurationSec = useStore(
    (state) => state.setAnimationDurationSec,
  );
  const preferredPlaybackMode = useStore(
    (state) => state.animationPlaybackMode,
  );
  const setPreferredPlaybackMode = useStore(
    (state) => state.setAnimationPlaybackMode,
  );
  const skipDetectedStops = useStore((state) => state.skipDetectedStops);
  const setSkipDetectedStops = useStore((state) => state.setSkipDetectedStops);
  const showTimedPhotos = useStore((state) => state.showTimedPhotos);
  const setShowTimedPhotos = useStore((state) => state.setShowTimedPhotos);

  const effectivePlaybackMode = routeContext?.effectivePlaybackMode;
  const settingsDisabled = routeContext?.animationSettingsDisabled ?? false;
  const preferredModeUnsupported =
    routeContext !== null &&
    !routeContext.availablePlaybackModes.includes(preferredPlaybackMode);
  const skipStopsUnsupported =
    routeContext !== null &&
    (!routeContext.timestampCapable || effectivePlaybackMode !== "recorded");

  return (
    <Stack spacing={2.5}>
      <Typography variant="h6" component="h2">
        Map Animation
      </Typography>
      {settingsDisabled && (
        <Typography variant="body2" color="text.secondary">
          Animation settings are unavailable while route completion is being
          presented.
        </Typography>
      )}
      <FormControl size="small" fullWidth>
        <InputLabel id="settings-duration-label">
          Target route duration
        </InputLabel>
        <Tooltip
          describeChild
          title="The time that the animation will take to complete from start to finish"
        >
          <Select<TargetRouteDurationSec>
            labelId="settings-duration-label"
            label="Target route duration"
            value={targetDurationSec}
            disabled={settingsDisabled}
            onChange={(event) => setTargetDurationSec(event.target.value)}
          >
            {TARGET_ROUTE_DURATIONS_SEC.map((value) => (
              <MenuItem key={value} value={value}>
                {value} seconds
              </MenuItem>
            ))}
          </Select>
        </Tooltip>
        <FormHelperText>{`Have animation run for ${targetDurationSec} seconds.`}</FormHelperText>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel id="settings-playback-mode-label">
          Preferred playback mode
        </InputLabel>
        <Tooltip
          describeChild
          title="How the animation marker advances along the route."
        >
          <Select<RoutePlaybackMode>
            labelId="settings-playback-mode-label"
            label="Preferred playback mode"
            value={preferredPlaybackMode}
            disabled={settingsDisabled}
            onChange={(event) => setPreferredPlaybackMode(event.target.value)}
          >
            {PLAYBACK_MODES.map((mode) => (
              <MenuItem key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </MenuItem>
            ))}
          </Select>
        </Tooltip>
        <FormHelperText>
          <span> {playbackDescription[preferredPlaybackMode]}</span>
          {preferredModeUnsupported && effectivePlaybackMode && (
            <span style={{ color: "darkred" }}>
              Not supported by the current route. Playback uses “
              {MODE_LABELS[effectivePlaybackMode]}”.
            </span>
          )}
        </FormHelperText>
      </FormControl>
      <FormControl>
        <Tooltip
          describeChild
          title="Whether to pause and linger over areas where no movement occurred for a while"
        >
          <FormControlLabel
            control={
              <Switch
                checked={skipDetectedStops}
                disabled={settingsDisabled}
                onChange={(event) => setSkipDetectedStops(event.target.checked)}
              />
            }
            label="Skip detected stops"
          />
        </Tooltip>
        {skipStopsUnsupported && (
          <FormHelperText>
            Not supported by the current route. This preference applies to
            recorded-time playback.
          </FormHelperText>
        )}
      </FormControl>
      <FormControl>
        <Tooltip
          describeChild
          title="Pause the animation and show geotagged photos when playback reaches the time corresponding with when they were taken. Requires photo to have a valid location and timestamp."
        >
          <FormControlLabel
            control={
              <Switch
                checked={showTimedPhotos}
                disabled={settingsDisabled}
                onChange={(event) => setShowTimedPhotos(event.target.checked)}
              />
            }
            label="Show timed photos"
          />
        </Tooltip>
        {routeContext && !routeContext.timestampCapable && (
          <FormHelperText>
            Not supported by the current route because recorded timestamps are
            unavailable.
          </FormHelperText>
        )}
      </FormControl>
    </Stack>
  );
}
