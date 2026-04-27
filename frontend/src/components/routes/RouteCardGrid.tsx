import { schemas } from "@/generatedtypes/django_generated";
import { dropboxShareUrlToDirectDownload } from "@/utils/dropboxImgHelpers";
import { formatDate } from "@/utils/datetimeHelpers";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type { z } from "zod";

type Route = z.infer<typeof schemas.Route>;

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'><rect width='320' height='180' fill='%23e0e0e0'/><text x='50%' y='50%' fill='%23888' font-family='sans-serif' font-size='16' text-anchor='middle' dominant-baseline='middle'>No photo</text></svg>";

function thumbnailFor(route: Route): string {
  const first = route.photos?.[0]?.url;
  if (!first) return PLACEHOLDER_IMG;
  return dropboxShareUrlToDirectDownload(first) || first;
}

function RouteCard({ route }: { route: Route }) {
  const navigate = useNavigate();
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardActionArea
        onClick={() =>
          void navigate({
            to: "/routes/$routeId",
            params: { routeId: route.id },
          })
        }
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <CardMedia
          component="img"
          height="160"
          image={thumbnailFor(route)}
          alt={route.title ?? "Route thumbnail"}
          sx={{ objectFit: "cover", bgcolor: "grey.200" }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="div" gutterBottom noWrap>
            {route.title ?? "Untitled route"}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
            <Chip
              label={route.activity_type}
              size="small"
              color="secondary"
              variant="outlined"
            />
            <Chip
              label={route.is_public ? "Public" : "Private"}
              size="small"
              color={route.is_public ? "success" : "default"}
              variant={route.is_public ? "filled" : "outlined"}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {formatDate(route.activity_date, "mmm-dd-yyyy")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {route.distance.toFixed(1)} km
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function RouteCardSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <Skeleton variant="rectangular" height={160} />
      <CardContent>
        <Skeleton variant="text" width="80%" height={32} />
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Skeleton variant="rounded" width={70} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
        </Stack>
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="40%" />
      </CardContent>
    </Card>
  );
}

export default function RouteCardGrid({
  routes,
  isLoading,
}: {
  routes: Route[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <RouteCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!routes.length) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">No routes to show.</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {routes.map((route) => (
        <Grid key={route.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <RouteCard route={route} />
        </Grid>
      ))}
    </Grid>
  );
}
