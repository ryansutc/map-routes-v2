import RouteTable from "@/components/routes/RouteTable";
import RouteWrapper from "@/components/routes/RouteWrapper";
import { useStore } from "@/state/store";
import { Box, CircularProgress, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/routes/")({
  component: RoutesIndex,
  errorComponent: RoutesError,
});

function RoutesIndex() {
  const { userIsAuthenticated } = useStore();
  return (
    <>
      <h2>Routes</h2>
      <RouteWrapper>
        {userIsAuthenticated === undefined ? (
          <CircularProgress />
        ) : (
          <RouteTable />
        )}
      </RouteWrapper>
    </>
  );
}

function RoutesError({ error }: { error: Error }) {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Couldn't load routes
      </Typography>
      <Typography color="text.secondary">{error.message}</Typography>
    </Box>
  );
}
