import Typography from "@mui/material/Typography";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ProfilePoint } from "@/hooks/useElevationProfile";
import { formatDistance, formatElevation } from "@/utils/units";
import { useStore } from "@/state/store";

type Props = {
  profilePoints: ProfilePoint[];
  hasElevation: boolean;
  onHover: (index: number) => void;
  onHoverEnd: () => void;
};

type RechartsMouseEvent = {
  activeTooltipIndex?: number | null;
};

export default function ElevationProfile({
  profilePoints,
  hasElevation,
  onHover,
  onHoverEnd,
}: Props) {
  const { units } = useStore();

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

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart
        data={profilePoints}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
        onMouseMove={handleMouseMove as never}
        onMouseLeave={onHoverEnd}
      >
        <XAxis
          dataKey="distance"
          tickFormatter={(v: number) => formatDistance(v, units)}
          tick={{ fontSize: 11 }}
          minTickGap={40}
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
      </LineChart>
    </ResponsiveContainer>
  );
}
