import { formatDate } from "@/utils/datetimeHelpers";
import { schemas } from "@/generatedtypes/django_generated";
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
import { useState } from "react";
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

export default function RouteInfoContainer({ routeItem }: { routeItem: Route }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Typography variant="h4" component="h1" gutterBottom sx={{ flex: 1, mr: 1 }}>
          {routeItem.title ?? "Untitled route"}
        </Typography>
        {routeItem.is_public && (
          <Tooltip title={copied ? "Copied!" : "Copy link"}>
            <IconButton onClick={handleCopyLink} size="small" sx={{ mt: 0.5, fontSize: 14 }}>
              ⎘
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
        {routeItem.distance.toFixed(1)} km
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        by {routeItem.owner}
      </Typography>

      {routeItem.notes && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2">{routeItem.notes}</Typography>
        </>
      )}
    </Box>
  );
}
