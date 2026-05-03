import RouteCardGrid from "@/components/routes/RouteCardGrid";
import RouteTableView from "@/components/routes/RouteTableView";
import { useRoutes } from "@/hooks/useRoutes";
import { useStore } from "@/state/store";
import { GOOGLE_LOGIN_URL } from "@/utils/environment";
import {
  Box,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

type RoutesListSearch = {
  tab?: "public" | "mine";
};

export const Route = createFileRoute("/routes/")({
  validateSearch: (search: Record<string, unknown>): RoutesListSearch => {
    const raw = search.tab;
    return raw === "mine" ? { tab: "mine" } : {};
  },
  // Guard: if auth has already resolved to false when navigating to ?tab=mine,
  // redirect immediately to Google OAuth before the component mounts.
  beforeLoad: ({ search }) => {
    const { userIsAuthenticated } = useStore.getState();
    if (search.tab === "mine" && userIsAuthenticated === false) {
      throw redirect({ href: GOOGLE_LOGIN_URL });
    }
  },
  component: RoutesIndex,
  errorComponent: RoutesError,
});

function RoutesIndex() {
  const search = Route.useSearch();
  const tab: "public" | "mine" = search.tab ?? "public";
  const navigate = useNavigate({ from: Route.fullPath });
  const user = useStore((s) => s.user);
  const userIsAuthenticated = useStore((s) => s.userIsAuthenticated);
  const listView = useStore((s) => s.listView);
  const setListView = useStore((s) => s.setListView);

  // Cold-load guard: auth was undefined when beforeLoad ran but has now resolved.
  // Redirect to OAuth instead of showing an empty/broken "My Routes" tab.
  useEffect(() => {
    if (tab === "mine" && userIsAuthenticated === false) {
      window.location.href = GOOGLE_LOGIN_URL;
    }
  }, [tab, userIsAuthenticated]);

  const { data: routes, isLoading, isError, error } = useRoutes();

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    if (tab === "mine") {
      if (!user) return [];
      return routes.filter((r) => r.owner === user);
    }
    return routes.filter((r) => r.is_public);
  }, [routes, tab, user]);

  const handleTabChange = (
    _e: React.SyntheticEvent,
    value: "public" | "mine",
  ) => {
    void navigate({
      search: value === "mine" ? { tab: "mine" } : {},
    });
  };

  const handleViewChange = (
    _e: React.MouseEvent<HTMLElement>,
    value: "cards" | "table" | null,
  ) => {
    if (value) setListView(value);
  };

  // Auth still resolving — show spinner to prevent flash before redirect fires
  if (tab === "mine" && userIsAuthenticated === undefined) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="Route list tabs"
        >
          <Tab label="Public" value="public" />
          <Tooltip
            title={userIsAuthenticated ? "" : "Sign in to see your routes"}
            disableHoverListener={!!userIsAuthenticated}
          >
            <span>
              <Tab
                label="My Routes"
                value="mine"
                disabled={!userIsAuthenticated}
              />
            </span>
          </Tooltip>
        </Tabs>

        <ToggleButtonGroup
          value={listView}
          exclusive
          onChange={handleViewChange}
          size="small"
          aria-label="List presentation"
        >
          <ToggleButton value="cards" aria-label="Card view">
            Cards
          </ToggleButton>
          <ToggleButton value="table" aria-label="Table view">
            Table
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isError ? (
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Couldn't load routes
          </Typography>
          <Typography color="text.secondary">{error?.message}</Typography>
        </Box>
      ) : listView === "table" ? (
        <RouteTableView routes={filteredRoutes} isLoading={isLoading} />
      ) : (
        <RouteCardGrid routes={filteredRoutes} isLoading={isLoading} />
      )}
    </Box>
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
