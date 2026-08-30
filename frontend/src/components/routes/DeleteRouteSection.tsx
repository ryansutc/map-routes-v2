import { zodiosAPI } from "@/api/axiosClient";
import { routeQueryKey } from "@/hooks/useRoute";
import { useToast } from "@/hooks/useToast";
import {
  Alert,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

interface DeleteRouteSectionProps {
  routeId: number;
  routeTitle: string;
  isOwner: boolean;
  onBeforeNavigate: () => void;
}

function deletionErrorMessage(error: unknown) {
  const apiDetail =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data &&
    typeof error.response.data.detail === "string"
      ? error.response.data.detail
      : null;
  const detail = apiDetail ?? (error instanceof Error ? error.message : null);
  return detail
    ? `Could not delete the route: ${detail} Please try again.`
    : "Could not delete the route. Please try again.";
}

export function DeleteRouteSection({
  routeId,
  routeTitle,
  isOwner,
  onBeforeNavigate,
}: DeleteRouteSectionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const deletionInFlightRef = useRef(false);

  const deleteRoute = useMutation({
    mutationFn: () => zodiosAPI.route_destroy(undefined, { params: { id: routeId } }),
    onSuccess: async () => {
      onBeforeNavigate();
      queryClient.removeQueries({ queryKey: routeQueryKey(routeId), exact: true });
      await queryClient.invalidateQueries({ queryKey: ["routes"] });
      enqueueSnackbar("Route deleted", "success");
      setDialogOpen(false);
      await navigate({ to: "/routes" });
    },
    onSettled: () => {
      deletionInFlightRef.current = false;
    },
  });

  if (!isOwner) return null;

  const errorMessage = deletionErrorMessage(deleteRoute.error);
  const handleConfirm = () => {
    if (deletionInFlightRef.current) return;
    deletionInFlightRef.current = true;
    deleteRoute.mutate();
  };

  return (
    <>
      <Paper variant="outlined" sx={{ mt: 5, p: 2, borderColor: "error.main" }}>
        <Typography variant="h6" color="error.main" gutterBottom>
          Delete route
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Permanently remove this route and all of its hosted track and photo data.
        </Typography>
        <Collapse in={deleteRoute.isError}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        </Collapse>
        <Button
          variant="contained"
          color="error"
          onClick={() => setDialogOpen(true)}
          disabled={deleteRoute.isPending}
        >
          Delete route
        </Button>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!deleteRoute.isPending) setDialogOpen(false);
        }}
        aria-labelledby="delete-route-dialog-title"
      >
        <DialogTitle id="delete-route-dialog-title">Delete “{routeTitle}”?</DialogTitle>
        <DialogContent>
          <Typography>
            This route, its track, and photos will be permanently removed. This cannot be undone.
          </Typography>
          <Collapse in={deleteRoute.isError}>
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage}
            </Alert>
          </Collapse>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={deleteRoute.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirm}
            disabled={deleteRoute.isPending}
          >
            {deleteRoute.isPending ? "Deleting…" : "Delete route"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
