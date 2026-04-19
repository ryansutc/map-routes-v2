import { useStore } from "@/state/store";
import { Button } from "@mui/material";

export default function Toggle3d() {
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
        title={`Switch to ${viewMode === "3d" ? "2d" : "3d"} view`}
        onClick={() => setViewMode(viewMode === "3d" ? "2d" : "3d")}
      >
        {viewMode === "3d" ? "2d" : "3d"}
      </Button>
    </div>
  );
}
