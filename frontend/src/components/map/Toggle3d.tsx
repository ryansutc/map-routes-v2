import { useStore } from "@/state/store";
import { Button } from "@mui/material";

interface Toggle3dProps {
  /** Switching view modes rebuilds the ESRI view, which would kill a running animation. */
  disabled?: boolean;
}

export default function Toggle3d({ disabled = false }: Toggle3dProps) {
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const style = {
    position: "absolute",
    bottom: "24px",
    right: "12px",
    backgroundColor: "white",
    padding: "8px",
    borderRadius: "8px",
    zIndex: 1000,
  } as React.CSSProperties;
  return (
    <div id="mapSwitch" style={style}>
      <Button
        disabled={disabled}
        title={
          disabled
            ? "Unavailable while the animation is playing"
            : `Switch to ${viewMode === "3d" ? "2d" : "3d"} view`
        }
        onClick={() => setViewMode(viewMode === "3d" ? "2d" : "3d")}
      >
        {viewMode === "3d" ? "2d" : "3d"}
      </Button>
    </div>
  );
}
