import { zodiosAPI } from "@/api/axiosClient";
import { ACTIVITY_TYPES, type ActivityType } from "@/components/routes/routeFormOptions";
import { useRoute, routeQueryKey } from "@/hooks/useRoute";
import { useToast } from "@/hooks/useToast";
import { useStore } from "@/state/store";
import { formatDate } from "@/utils/datetimeHelpers";
import { formatDistance, formatElevation, formatPace } from "@/utils/units";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/routes/$routeId_/edit")({
  parseParams: ({ routeId }) => {
    const parsed = Number.parseInt(routeId, 10);
    if (Number.isNaN(parsed)) throw new Error("Invalid route id");
    return { routeId: parsed };
  },
  stringifyParams: ({ routeId }) => ({ routeId: String(routeId) }),
  component: RouteInfoEditor,
});

type FormState = {
  title: string;
  activityType: ActivityType | "";
  notes: string;
  isPublic: boolean;
};

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function RouteInfoEditor() {
  const { routeId } = Route.useParams();
  const { data: route, isLoading, error } = useRoute(routeId);
  const user = useStore((state) => state.user);
  const units = useStore((state) => state.units);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar, enqueueError } = useToast();
  const redirectedRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (route && form === null) {
      // Hydrate the editor once when the asynchronous route query resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        title: route.title ?? "",
        activityType: (route.activity_type ?? "") as ActivityType | "",
        notes: route.notes ?? "",
        isPublic: route.is_public ?? false,
      });
    }
  }, [form, route]);

  useEffect(() => {
    if (!route || !user || route.owner === user || redirectedRef.current) return;
    redirectedRef.current = true;
    enqueueError("Only the route owner can edit this route.");
    void navigate({ to: "/routes/$routeId", params: { routeId }, replace: true });
  }, [enqueueError, navigate, route, routeId, user]);

  const initial = useMemo<FormState | null>(
    () =>
      route
        ? {
            title: route.title ?? "",
            activityType: (route.activity_type ?? "") as ActivityType | "",
            notes: route.notes ?? "",
            isPublic: route.is_public ?? false,
          }
        : null,
    [route],
  );
  const isDirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));

  useBlocker({
    shouldBlockFn: () => {
      if (allowNavigationRef.current) return false;
      return !window.confirm("Discard your unsaved route changes?");
    },
    enableBeforeUnload: isDirty,
    disabled: !isDirty,
  });

  const updateRoute = useMutation({
    mutationFn: (values: FormState) =>
      zodiosAPI.route_partial_update(
        {
          title: values.title.trim(),
          activity_type: values.activityType as ActivityType,
          notes: values.notes.trim(),
          is_public: values.isPublic,
        },
        { params: { id: routeId } },
      ),
    onSuccess: async () => {
      allowNavigationRef.current = true;
      await queryClient.invalidateQueries({ queryKey: routeQueryKey(routeId) });
      await queryClient.invalidateQueries({ queryKey: ["routes"] });
      enqueueSnackbar("Route updated", "success");
      await navigate({ to: "/routes/$routeId", params: { routeId }, replace: true });
    },
  });

  const titleValid = Boolean(form?.title.trim()) && (form?.title.trim().length ?? 0) <= 255;
  const activityValid = Boolean(
    form?.activityType && ACTIVITY_TYPES.includes(form.activityType as ActivityType),
  );

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved route changes?")) return;
    allowNavigationRef.current = true;
    void navigate({ to: "/routes/$routeId", params: { routeId } });
  };

  const handleSave = () => {
    setSubmitted(true);
    if (!form || !titleValid || !activityValid || !isDirty) return;
    updateRoute.mutate(form);
  };

  if (isLoading || !form) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress aria-label="Loading route editor" />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Could not load this route: {error.message}</Alert>;
  }

  if (!route || route.owner !== user) return null;

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleCancel} sx={{ mb: 2 }}>
        Back to route
      </Button>
      <Typography variant="h5" component="h1" gutterBottom>
        Edit route
      </Typography>

      <Stack spacing={3}>
        <TextField
          label="Title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          error={submitted && !titleValid}
          helperText={
            submitted && !form.title.trim()
              ? "Title is required"
              : form.title.length > 255
                ? "Title must be 255 characters or fewer"
                : ""
          }
          slotProps={{ htmlInput: { maxLength: 255 } }}
        />

        <FormControl error={submitted && !activityValid}>
          <InputLabel id="edit-activity-type-label">Activity type *</InputLabel>
          <Select
            labelId="edit-activity-type-label"
            label="Activity type *"
            value={form.activityType}
            onChange={(event) =>
              setForm({ ...form, activityType: event.target.value as ActivityType })
            }
          >
            {ACTIVITY_TYPES.map((activityType) => (
              <MenuItem key={activityType} value={activityType}>
                {activityType}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={form.isPublic}
              onChange={(event) => setForm({ ...form, isPublic: event.target.checked })}
            />
          }
          label="Public route"
        />

        <TextField
          label="Notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          multiline
          minRows={4}
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            GPX-derived information
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This information comes from the original GPX file and cannot be changed.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1,
            }}
          >
            <Typography variant="body2">
              Date: {formatDate(route.activity_date, "mmm-dd-yyyy")}
            </Typography>
            <Typography variant="body2">
              Distance: {formatDistance(route.distance, units)}
            </Typography>
            <Typography variant="body2">
              Duration: {formatDuration(route.duration)}
            </Typography>
            <Typography variant="body2">
              Average pace: {formatPace(route.avg_pace == null ? null : Number(route.avg_pace), units)}
            </Typography>
            <Typography variant="body2">
              Elevation gain:{" "}
              {formatElevation(
                route.elevation_gain == null ? null : Number(route.elevation_gain),
                units,
              )}
            </Typography>
          </Box>
        </Paper>

        {updateRoute.isError && (
          <Alert severity="error">
            {(updateRoute.error as Error).message || "Could not update the route."}
          </Alert>
        )}

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={handleCancel} disabled={updateRoute.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isDirty || updateRoute.isPending}
          >
            {updateRoute.isPending ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
