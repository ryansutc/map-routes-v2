import { useStore } from "@/state/store";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

interface Toggle3dProps {
  /** Switching view modes rebuilds the ESRI view, which would kill a running animation. */
  disabled?: boolean;
}

export default function Toggle3d({ disabled = false }: Toggle3dProps) {
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);

  return (
    <Tooltip
      title={disabled ? "Unavailable while the animation is playing" : ""}
    >
      <ToggleButtonGroup
        id="mapSwitch"
        value={viewMode}
        exclusive
        disabled={disabled}
        size="small"
        aria-label="Map view mode"
        onChange={(_, mode) => {
          if (mode) setViewMode(mode);
        }}
        sx={{
          position: "absolute",
          top: 16,
          right: 64,
          zIndex: 1000,
          bgcolor: "background.paper",
          boxShadow: 1,
          "& .MuiToggleButton-root": {
            px: 1.5,
            py: 0.75,
          },
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <ToggleButton value="2d" aria-label="2D map view">
          2D
        </ToggleButton>
        <ToggleButton value="3d" aria-label="3D map view">
          3D
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}
