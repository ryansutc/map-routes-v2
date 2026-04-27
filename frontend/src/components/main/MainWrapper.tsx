import { zodiosAPI } from "@/api/axiosClient";
import { ROUTES_QUERY_KEY } from "@/hooks/useRoutes";
import { useStore } from "@/state/store";
import { Grid } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function MainWrapper({ children }: React.PropsWithChildren) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { userIsAuthenticated, setUserIsAuthenticated, setUser } = useStore();

  useEffect(() => {
    async function checkStatus() {
      try {
        const userInfo = await zodiosAPI.auth_status_retrieve();
        if (userInfo && userInfo.is_authenticated) {
          setUser(userInfo.user_name!);
          setUserIsAuthenticated(userInfo.is_authenticated);
        } else {
          setUserIsAuthenticated(false);
        }
      } catch (e) {
        console.error("Failed to get user info: ", e);
        setError(e);
        localStorage.clear?.();
        return;
      }
    }
    if (userIsAuthenticated === undefined) {
      // we have not attempted to get login status yet:

      checkStatus();
    } else {
      // if authenticated status changes, refetch the routes list
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    }
  }, [queryClient, setUser, setUserIsAuthenticated, userIsAuthenticated]);

  if (error) {
    const errorMessage =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : JSON.stringify(error);
    return `Something went wrong: ${errorMessage}`;
  }
  return (
    <Grid
      id="rootWrapper"
      container
      spacing={2}
      sx={{
        width: "100%",
        "& > *": {
          width: "100%",
        },
      }}
    >
      {children}
    </Grid>
  );
}
