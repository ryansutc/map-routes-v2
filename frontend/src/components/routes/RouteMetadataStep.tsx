import { useParseGpx } from "@/hooks/useParseGpx";
import {
  formatDistance,
  formatElevation,
  formatPace,
} from "@/utils/units";
import { useStore } from "@/state/store";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { ActivityType, WizardState } from "./CreateRouteWizard";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
const ACTIVITY_TYPES: ActivityType[] = [
  "Hiking",
  "Running",
  "Cycling",
  "Backpacking",
  "Skiing",
  "Other",
];

type Props = {
  wizardState: WizardState;
  onNext: (updates: Partial<WizardState>) => void;
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function RouteMetadataStep({ wizardState, onNext }: Props) {
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [title, setTitle] = useState(wizardState.title);
  const [activityType, setActivityType] = useState<ActivityType | "">(
    wizardState.activityType,
  );
  const [isPublic, setIsPublic] = useState(wizardState.isPublic);
  const [notes, setNotes] = useState(wizardState.notes);
  const [submitted, setSubmitted] = useState(false);

  const { units } = useStore();
  const parseGpx = useParseGpx();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setGpxFile(file);
        parseGpx.reset();
        parseGpx.mutate(file);
      }
    },
    [parseGpx],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/gpx+xml": [".gpx"], "text/xml": [".gpx"] },
    maxFiles: 1,
    disabled: parseGpx.isPending,
  });

  const canAdvance =
    parseGpx.isSuccess && title.trim() !== "" && activityType !== "";

  const handleNext = () => {
    setSubmitted(true);
    if (!canAdvance) return;
    onNext({
      parsed: parseGpx.data!,
      title: title.trim(),
      activityType,
      isPublic,
      notes,
    });
  };

  const parsed = parseGpx.data;

  return (
    <Stack spacing={3}>
      {/* GPX drop zone */}
      <Box>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Upload GPX file
        </Typography>
        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "divider",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
            cursor: parseGpx.isPending ? "not-allowed" : "pointer",
            bgcolor: isDragActive ? "action.hover" : "background.paper",
            transition: "border-color 0.2s, background-color 0.2s",
          }}
        >
          <input {...getInputProps()} />
          {gpxFile ? (
            <Typography variant="body2">{gpxFile.name}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {isDragActive
                ? "Drop your GPX file here"
                : "Drag & drop a .gpx file, or click to select"}
            </Typography>
          )}
        </Box>

        {(parseGpx.isPending || parseGpx.isSuccess) && (
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            {parseGpx.isPending && (
              <>
                <CircularProgress size={16} color="inherit" />
                <Typography variant="body2" color="text.secondary">
                  Parsing…
                </Typography>
              </>
            )}
            {parseGpx.isSuccess && (
              <>
                <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                <Typography variant="body2" color="success.main">
                  Parsed successfully
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    setGpxFile(null);
                    parseGpx.reset();
                  }}
                  sx={{
                    py: 0,
                    minWidth: 0,
                    fontSize: "0.75rem",
                    borderWidth: 0,
                    color: "text.primary",
                  }}
                >
                  Clear
                </Button>
              </>
            )}
          </Box>
        )}

        {parseGpx.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {(parseGpx.error as Error)?.message ?? "Failed to parse GPX"}
          </Alert>
        )}
      </Box>

      {/* Auto-filled read-only fields */}
      {parsed && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            label="Date"
            value={new Date(parsed.date).toLocaleDateString()}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />
          <TextField
            label="Distance"
            value={formatDistance(parsed.distance_m, units)}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />
          <TextField
            label="Duration"
            value={formatDuration(parsed.duration_s)}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />
          <TextField
            label="Avg Pace"
            value={formatPace(parsed.avg_pace_decimal, units)}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />
          <TextField
            label="Elevation Gain"
            value={formatElevation(parsed.elevation_gain_m, units)}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />
        </Box>
      )}

      {/* Editable fields */}
      <TextField
        label="Title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={submitted && title.trim() === ""}
        helperText={submitted && title.trim() === "" ? "Title is required" : ""}
        fullWidth
        size="small"
      />

      <FormControl
        fullWidth
        size="small"
        error={submitted && activityType === ""}
      >
        <InputLabel id="activity-type-label">Activity Type *</InputLabel>
        <Select
          labelId="activity-type-label"
          label="Activity Type *"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value as ActivityType)}
        >
          {ACTIVITY_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
        {submitted && activityType === "" && (
          <Typography
            variant="caption"
            color="error"
            sx={{ mt: 0.5, ml: 1.75 }}
          >
            Activity type is required
          </Typography>
        )}
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
        }
        label="Public route"
      />

      <TextField
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        rows={3}
        fullWidth
        size="small"
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!parseGpx.isSuccess}
        >
          Next
        </Button>
      </Box>
    </Stack>
  );
}
