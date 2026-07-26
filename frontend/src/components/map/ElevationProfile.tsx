import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";
import {
  LineChart,
  Line,
  ReferenceDot,
  ReferenceLine,
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

export default function ElevationProfile({
  profilePoints,
  hasElevation,
  onHover,
  onHoverEnd,
  isAnimating = false,
}: Props) {
  const units = useStore((s) => s.units);
  const progress = useStore((s) => s.animationProgress);

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

  const handleMouseMove = (e: RechartsMouseEvent) => {
    if (e?.activeTooltipIndex != null) {
      onHover(e.activeTooltipIndex);
    }
  };

  const totalDistance = profilePoints.at(-1)?.distance ?? 0;
  const { max: axisMax, ticks } = distanceAxisTicks(totalDistance, units);

  // Mirror the map marker: appears on play, parks at the end when playback
  // completes, disappears when playback is stopped (progress resets to 0).
  const showCursor = isAnimating || progress > 0;
  const cursorDistance = progress * totalDistance;
  const cursorElevation = elevationAtDistance(profilePoints, cursorDistance);

  return (
    <Box sx={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={180}>
      <LineChart
        data={profilePoints}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
        onMouseMove={handleMouseMove as never}
        onMouseLeave={onHoverEnd}
      >
        <XAxis
          dataKey="distance"
          type="number"
          domain={[0, axisMax]}
          ticks={ticks}
          allowDataOverflow={false}
          tickFormatter={(v: number) => formatDistanceTick(v, units)}
          tick={{ fontSize: 11 }}
          minTickGap={20}
        />
        <YAxis
          dataKey="elevation"
          tickFormatter={(v: number) => formatElevation(v, units)}
          tick={{ fontSize: 11 }}
          width={55}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? [formatElevation(value, units), "Elevation"]
              : [String(value), "Elevation"]
          }
          labelFormatter={(label) =>
            typeof label === "number" ? formatDistance(label, units) : String(label)
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
        {showCursor && (
          <ReferenceLine
            x={cursorDistance}
            stroke="#888"
            strokeDasharray="3 3"
          />
        )}
        {showCursor && (
          <ReferenceDot
            x={cursorDistance}
            y={cursorElevation}
            r={5}
            fill="#ff3232"
            stroke="#fff"
            strokeWidth={1.5}
          />
        )}
      </LineChart>
      </ResponsiveContainer>
      {isAnimating && (
        // Swallow pointer events so hover can't fight the animation marker.
        <Box sx={{ position: "absolute", inset: 0, zIndex: 2 }} />
      )}
    </Box>
  );
}
