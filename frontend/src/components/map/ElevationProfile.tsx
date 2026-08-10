import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { memo, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ProfilePoint } from "@/hooks/useElevationProfile";
import { elevationAtDistance } from "@/utils/elevationProfile";
import {
  distanceAxisTicks,
  formatDistance,
  formatDistanceTick,
  formatElevation,
} from "@/utils/units";
import { useStore } from "@/state/store";
import { routeAnimationProgress } from "@/state/routeAnimationProgress";

type Props = {
  profilePoints: ProfilePoint[];
  hasElevation: boolean;
  onHover: (index: number) => void;
  onHoverEnd: () => void;
  /** While the route animation plays the chart is read-only and shows a cursor. */
  isAnimating?: boolean;
};

type RechartsMouseEvent = {
  activeTooltipIndex?: number | null;
};

const CHART_HEIGHT = 180;
const CHART_MARGIN = { top: 4, right: 8, left: 8, bottom: 4 } as const;
const Y_AXIS_WIDTH = 55;
const X_AXIS_HEIGHT = 30;

const CursorPlot = styled(Box)({
  position: "absolute",
  top: CHART_MARGIN.top,
  right: CHART_MARGIN.right,
  bottom: CHART_MARGIN.bottom + X_AXIS_HEIGHT,
  left: CHART_MARGIN.left + Y_AXIS_WIDTH,
  pointerEvents: "none",
  zIndex: 1,
});

const CursorLine = styled(Box)({
  position: "absolute",
  top: 0,
  bottom: 0,
  borderLeft: "1px dashed #888",
});

const CursorMarker = styled(Box)({
  position: "absolute",
  width: 10,
  height: 10,
  border: "1.5px solid #fff",
  borderRadius: "50%",
  background: "#ff3232",
  transform: "translate(-50%, -50%)",
  boxSizing: "border-box",
});

type StaticChartProps = Pick<
  Props,
  "profilePoints" | "onHover" | "onHoverEnd"
> & {
  axisMax: number;
  ticks: number[];
  units: ReturnType<typeof useStore.getState>["units"];
  elevationDomain: [number, number];
};

const StaticElevationChart = memo(function StaticElevationChart({
  profilePoints,
  onHover,
  onHoverEnd,
  axisMax,
  ticks,
  units,
  elevationDomain,
}: StaticChartProps) {
  const handleMouseMove = (e: RechartsMouseEvent) => {
    if (e?.activeTooltipIndex != null) onHover(e.activeTooltipIndex);
  };

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart
        data={profilePoints}
        margin={CHART_MARGIN}
        onMouseMove={handleMouseMove as never}
        onMouseLeave={onHoverEnd}
      >
        <XAxis
          dataKey="distance"
          type="number"
          domain={[0, axisMax]}
          ticks={ticks}
          height={X_AXIS_HEIGHT}
          allowDataOverflow={false}
          tickFormatter={(v: number) => formatDistanceTick(v, units)}
          tick={{ fontSize: 11 }}
          minTickGap={20}
        />
        <YAxis
          dataKey="elevation"
          domain={elevationDomain}
          tickFormatter={(v: number) => formatElevation(v, units)}
          tick={{ fontSize: 11 }}
          width={Y_AXIS_WIDTH}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? [formatElevation(value, units), "Elevation"]
              : [String(value), "Elevation"]
          }
          labelFormatter={(label) =>
            typeof label === "number"
              ? formatDistance(label, units)
              : String(label)
          }
        />
        <Line
          type="monotone"
          dataKey="elevation"
          dot={false}
          stroke="#ff9100"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

function ElevationAnimationCursor({
  profilePoints,
  axisMax,
  elevationDomain,
  isAnimating,
}: Pick<Props, "profilePoints" | "isAnimating"> & {
  axisMax: number;
  elevationDomain: [number, number];
}) {
  const distanceProgress = useSyncExternalStore(
    routeAnimationProgress.subscribe,
    routeAnimationProgress.getSnapshot,
    routeAnimationProgress.getSnapshot,
  );
  const showCursor = isAnimating || distanceProgress > 0;
  if (!showCursor) return null;

  const totalDistance = profilePoints.at(-1)?.distance ?? 0;
  const cursorDistance = distanceProgress * totalDistance;
  const cursorElevation = elevationAtDistance(profilePoints, cursorDistance);
  const horizontalPercent =
    axisMax > 0 ? (cursorDistance / axisMax) * 100 : 0;
  const [minimumElevation, maximumElevation] = elevationDomain;
  const elevationSpan = maximumElevation - minimumElevation;
  const verticalPercent =
    elevationSpan > 0
      ? ((maximumElevation - cursorElevation) / elevationSpan) * 100
      : 50;

  return (
    <CursorPlot aria-hidden="true">
      <CursorLine sx={{ left: `${horizontalPercent}%` }} />
      <CursorMarker
        data-testid="elevation-animation-cursor"
        data-elevation={cursorElevation}
        data-distance-progress={distanceProgress}
        sx={{
          left: `${horizontalPercent}%`,
          top: `${verticalPercent}%`,
        }}
      />
    </CursorPlot>
  );
}

export default function ElevationProfile({
  profilePoints,
  hasElevation,
  onHover,
  onHoverEnd,
  isAnimating = false,
}: Props) {
  const units = useStore((s) => s.units);
  const elevationDomain = useMemo<[number, number]>(() => {
    const elevations = profilePoints.map((point) => point.elevation);
    return [Math.min(0, ...elevations), Math.max(0, ...elevations)];
  }, [profilePoints]);

  // Playback owns the map marker, so drop any leftover hover highlight.
  useEffect(() => {
    if (isAnimating) onHoverEnd();
  }, [isAnimating, onHoverEnd]);

  if (!hasElevation) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        No elevation information available.
      </Typography>
    );
  }

  const totalDistance = profilePoints.at(-1)?.distance ?? 0;
  const { max: axisMax, ticks } = distanceAxisTicks(totalDistance, units);

  return (
    <Box sx={{ position: "relative" }}>
      <StaticElevationChart
        profilePoints={profilePoints}
        onHover={onHover}
        onHoverEnd={onHoverEnd}
        axisMax={axisMax}
        ticks={ticks}
        units={units}
        elevationDomain={elevationDomain}
      />
      <ElevationAnimationCursor
        profilePoints={profilePoints}
        axisMax={axisMax}
        elevationDomain={elevationDomain}
        isAnimating={isAnimating}
      />
      {isAnimating && (
        // Swallow pointer events so hover can't fight the animation marker.
        <Box
          data-testid="elevation-hover-blocker"
          sx={{ position: "absolute", inset: 0, zIndex: 2 }}
        />
      )}
    </Box>
  );
}
