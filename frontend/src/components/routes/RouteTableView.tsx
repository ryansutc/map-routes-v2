import { schemas } from "@/generatedtypes/django_generated";
import { formatDate } from "@/utils/datetimeHelpers";
import { formatDistance } from "@/utils/units";
import { useStore } from "@/state/store";
import {
  Box,
  Chip,
  Link as MuiLink,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type { z } from "zod";

type Route = z.infer<typeof schemas.Route>;

const COLUMNS = ["Title", "Activity", "Date", "Distance", "Visibility"];
const XL_COLUMNS = ["Uploaded"];

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {COLUMNS.map((c) => (
            <TableCell key={c}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function RouteTableView({
  routes,
  isLoading,
}: {
  routes: Route[];
  isLoading?: boolean;
}) {
  const navigate = useNavigate();
  const { units } = useStore();

  if (!isLoading && !routes.length) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">No routes to show.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ width: "100%" }}>
      <Table size="small" aria-label="Routes table">
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableCell key={col}>{col}</TableCell>
            ))}
            {XL_COLUMNS.map((col) => (
              <TableCell key={col} sx={{ display: { xs: "none", xl: "table-cell" } }}>
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            routes.map((route) => {
              const goToRoute = () =>
                void navigate({
                  to: "/routes/$routeId",
                  params: { routeId: route.id },
                });
              return (
                <TableRow
                  key={route.id}
                  hover
                  onClick={goToRoute}
                  sx={{
                    cursor: "pointer",
                    "&:last-child td, &:last-child th": { border: 0 },
                  }}
                >
                  <TableCell>
                    <MuiLink
                      component="button"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToRoute();
                      }}
                      underline="hover"
                      sx={{ textAlign: "left", font: "inherit" }}
                    >
                      {route.title ?? "Untitled route"}
                    </MuiLink>
                  </TableCell>
                  <TableCell>{route.activity_type}</TableCell>
                  <TableCell>
                    {formatDate(route.activity_date, "mmm-dd-yyyy")}
                  </TableCell>
                  <TableCell>{formatDistance(route.distance, units)}</TableCell>
                  <TableCell>
                    <Chip
                      label={route.is_public ? "Public" : "Private"}
                      size="small"
                      color={route.is_public ? "success" : "default"}
                      variant={route.is_public ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", xl: "table-cell" } }}>
                    uploaded {formatDate(route.created_at, "mmm-dd-yyyy")}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
