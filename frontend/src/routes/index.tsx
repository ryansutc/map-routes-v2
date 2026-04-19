import RouteTable from "@/components/routes/RouteTable";
import RouteWrapper from "@/components/routes/RouteWrapper";
import { useStore } from "@/state/store";
import { CircularProgress } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

/**
 * On the main index route "/", we display
 * the table of the routes
 *
 * @returns
 */
function Index() {
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
