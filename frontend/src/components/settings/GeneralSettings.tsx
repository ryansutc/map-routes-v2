import { useStore } from "@/state/store";
import type { UnitSystem } from "@/utils/units";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";

export function GeneralSettings() {
  const units = useStore((state) => state.units);
  const setUnits = useStore((state) => state.setUnits);
  const themeMode = useStore((state) => state.themeMode);
  const setThemeMode = useStore((state) => state.setThemeMode);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        General
      </Typography>
      <FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={themeMode === "dark"}
              onChange={(_, checked) =>
                setThemeMode(checked ? "dark" : "light")
              }
              slotProps={{ input: { "aria-describedby": "dark-mode-help" } }}
            />
          }
          label="Dark mode"
        />
        <FormHelperText id="dark-mode-help">
          Use a darker color scheme throughout the app.
        </FormHelperText>
      </FormControl>
      <FormControl>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Preferred Units
        </Typography>
        <Tooltip
          describeChild
          title="Show distances and elevations in appropriate units"
        >
          <ToggleButtonGroup
            value={units}
            exclusive
            onChange={(_, value: UnitSystem | null) => {
              if (value) setUnits(value);
            }}
            size="small"
            aria-label="Distance units"
          >
            <ToggleButton value="metric">metric</ToggleButton>
            <ToggleButton value="imperial">imperial</ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
        <FormHelperText>
          {units === "metric"
            ? "use meters (m) and kilometers (km) in app."
            : "use feet (ft) and miles (mi) in app."}
        </FormHelperText>
      </FormControl>
    </Stack>
  );
}
