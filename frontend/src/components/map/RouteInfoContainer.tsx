import { formatDate } from "@/utils/datetimeHelpers";
import { schemas } from "@/generatedtypes/django_generated";
import { formatDistance } from "@/utils/units";
import { useStore } from "@/state/store";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { z } from "zod";

type Route = z.infer<typeof schemas.Route>;

export function RouteInfoSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="text" width="70%" height={40} />
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <Skeleton variant="rounded" width={80} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </Stack>
      <Skeleton variant="text" width="50%" />
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="55%" />
      <Divider sx={{ my: 2 }} />
      <Skeleton variant="rectangular" height={120} />
    </Box>
  );
}

export default function RouteInfoContainer({
  routeItem,
  isOwner = false,
}: {
  routeItem: Route;
  isOwner?: boolean;
}) {
  const units = useStore((s) => s.units);
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Typography variant="h4" component="h1" gutterBottom sx={{ flex: 1, mr: 1 }}>
          {routeItem.title ?? "Untitled route"}
        </Typography>
        {isOwner && (
          <Tooltip title="Edit route">
            <IconButton
              onClick={() =>
                void navigate({
                  to: "/routes/$routeId/edit",
                  params: { routeId: routeItem.id },
                })
              }
              size="small"
              aria-label="Edit route"
              sx={{ mt: 0.5 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Chip
          label={routeItem.activity_type}
          size="small"
          color="secondary"
          variant="outlined"
        />
        <Chip
          label={routeItem.is_public ? "Public" : "Private"}
          size="small"
          color={routeItem.is_public ? "success" : "default"}
          variant={routeItem.is_public ? "filled" : "outlined"}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {formatDate(routeItem.activity_date, "mmm-dd-yyyy")}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {formatDistance(routeItem.distance, units)}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        by {routeItem.owner}
      </Typography>
      {routeItem.created_at && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          uploaded {formatDate(routeItem.created_at, "mmm-dd-yyyy")}
        </Typography>
      )}
      {routeItem.updated_at &&
        new Date(routeItem.updated_at).getTime() -
          new Date(routeItem.created_at).getTime() >
          1000 && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            updated {formatDate(routeItem.updated_at, "mmm-dd-yyyy")}
          </Typography>
        )}

      {routeItem.notes && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2">{routeItem.notes}</Typography>
        </>
      )}
    </Box>
  );
}
