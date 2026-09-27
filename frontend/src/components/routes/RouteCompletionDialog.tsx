import { useStore } from "@/state/store";
import { formatCompactDuration } from "@/utils/duration";
import { formatDistance, formatElevation } from "@/utils/units";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
  Unstable_TrapFocus as FocusTrap,
} from "@mui/material";
import { useEffect } from "react";

const TITLE_ID = "route-completion-title";
const MISSING_METRIC = "—";

type RouteCompletionDialogProps = {
  open: boolean;
  title?: string | null;
  distance?: number | null;
  elevationGain?: number | string | null;
  duration?: number | null;
  onClose: () => void;
};

function parseFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RouteCompletionDialog({
  open,
  title,
  distance,
  elevationGain,
  duration,
  onClose,
}: RouteCompletionDialogProps) {
  const units = useStore((state) => state.units);
  const distanceValue = parseFiniteNumber(distance);
  const elevationValue = parseFiniteNumber(elevationGain);
  const durationValue = parseFiniteNumber(duration);
  const metrics = [
    {
      label: "Distance",
      value:
        distanceValue === null
          ? MISSING_METRIC
          : formatDistance(distanceValue, units),
    },
    {
      label: "Elevation Gain",
      value:
        elevationValue === null
          ? MISSING_METRIC
          : formatElevation(elevationValue, units),
    },
    {
      label: "Duration",
      value:
        durationValue === null
          ? MISSING_METRIC
          : formatCompactDuration(durationValue),
    },
  ];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <Box
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "grid",
        placeItems: "center",
        p: 2,
        bgcolor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <FocusTrap open>
        <Paper
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITLE_ID}
          elevation={10}
          sx={{ position: "relative", width: "min(100%, 460px)", p: 3 }}
        >
          <IconButton
            autoFocus
            aria-label="Close route summary"
            onClick={onClose}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>
          <Typography id={TITLE_ID} variant="h5" component="h2" sx={{ pr: 5 }}>
            Route complete
          </Typography>
          {title && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {title}
            </Typography>
          )}
          <Stack direction="row" sx={{ mt: 3 }}>
            {metrics.map((metric) => (
              <Box
                key={metric.label}
                sx={{ flex: 1, minWidth: 0, textAlign: "center", px: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {metric.value}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      </FocusTrap>
    </Box>
  );
}
