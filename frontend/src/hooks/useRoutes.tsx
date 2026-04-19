import { zodiosAPI } from "@/api/axiosClient";
import { useStore } from "@/state/store";
import { useQuery } from "@tanstack/react-query";

export const ROUTE_ITEMS_QUERY_KEY = ["routeItems"] as const;

export function useRoutes() {
  const user = useStore((state) => state.user);
  const userIsAuthenticated = useStore((state) => state.userIsAuthenticated);

  return useQuery({
    queryKey: [ROUTE_ITEMS_QUERY_KEY, user, userIsAuthenticated],
    queryFn: () => zodiosAPI.getApiRoute(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
