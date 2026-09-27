import { isRouteSortField, type RouteSort } from "@/domain/routeSort";
import { useStore } from "@/state/store";
import type { RouteListResponseDto } from "@/types/api";
import { formatDate } from "@/utils/datetimeHelpers";
import { formatDistance } from "@/utils/units";
import { Box, Chip, Link as MuiLink, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  DataGrid,
  type GridColDef,
  type GridSortModel,
} from "@mui/x-data-grid";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useMemo } from "react";

function NoRoutesOverlay() {
  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography color="text.secondary">No routes to show.</Typography>
    </Box>
  );
}

export default function RouteTableView({
  routes,
  isLoading,
  sort,
  onSortChange,
}: {
  routes: RouteListResponseDto[];
  isLoading?: boolean;
  sort: RouteSort;
  onSortChange: (sort: RouteSort) => void;
}) {
  const navigate = useNavigate();
  const units = useStore((s) => s.units);
  const theme = useTheme();
  const showVisibility = useMediaQuery(theme.breakpoints.up("sm"));
  const showUploaded = useMediaQuery(theme.breakpoints.up("xl"));

  const goToRoute = useCallback(
    (routeId: number) =>
      void navigate({
        to: "/routes/$routeId",
        params: { routeId },
      }),
    [navigate],
  );

  const columns = useMemo<GridColDef<RouteListResponseDto>[]>(
    () => [
      {
        field: "title",
        headerName: "Title",
        minWidth: 180,
        flex: 1,
        renderCell: ({ row }) => (
          <MuiLink
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToRoute(row.id);
            }}
            underline="hover"
            sx={{ textAlign: "left", font: "inherit" }}
          >
            {row.title ?? "Untitled route"}
          </MuiLink>
        ),
      },
      {
        field: "activity_type",
        headerName: "Activity",
        minWidth: 130,
        flex: 0.7,
      },
      {
        field: "activity_date",
        headerName: "Date",
        minWidth: 125,
        flex: 0.6,
        renderCell: ({ value }) => formatDate(value, "mmm-dd-yyyy"),
      },
      {
        field: "distance",
        headerName: "Distance",
        minWidth: 115,
        flex: 0.5,
        renderCell: ({ value }) => formatDistance(value, units),
      },
      {
        field: "is_public",
        headerName: "Visibility",
        minWidth: 115,
        flex: 0.5,
        renderCell: ({ value }) => (
          <Chip
            label={value ? "Public" : "Private"}
            size="small"
            color={value ? "success" : "default"}
            variant={value ? "filled" : "outlined"}
          />
        ),
      },
      {
        field: "created_at",
        headerName: "Uploaded",
        minWidth: 145,
        flex: 0.7,
        renderCell: ({ value }) => (
          <span title={formatDate(value, "mmm-dd-yyyy")}>
            {formatDistanceToNow(new Date(value), { addSuffix: true })}
          </span>
        ),
      },
    ],
    [goToRoute, units],
  );

  const handleSortModelChange = (model: GridSortModel) => {
    const next = model[0];
    if (next?.sort && isRouteSortField(next.field)) {
      onSortChange({ field: next.field, direction: next.sort });
    }
  };

  return (
    <Paper sx={{ width: "100%" }}>
      <DataGrid
        aria-label="Routes table"
        autoHeight
        rows={routes}
        columns={columns}
        loading={isLoading}
        sortingMode="server"
        sortModel={[{ field: sort.field, sort: sort.direction }]}
        onSortModelChange={handleSortModelChange}
        sortingOrder={["asc", "desc"]}
        disableColumnFilter
        disableColumnMenu
        disableColumnSelector
        disableRowSelectionOnClick
        columnVisibilityModel={{
          is_public: showVisibility,
          created_at: showUploaded,
        }}
        pagination
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: 100 } },
        }}
        pageSizeOptions={[100]}
        hideFooter={routes.length <= 100}
        onRowClick={({ row }) => goToRoute(row.id)}
        slots={{ noRowsOverlay: NoRoutesOverlay }}
        sx={{
          border: 0,
          "& .MuiDataGrid-row": { cursor: "pointer" },
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
            outlineOffset: "-2px",
          },
        }}
      />
    </Paper>
  );
}
