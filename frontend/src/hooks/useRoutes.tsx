import { zodiosAPI } from "@/api/axiosClient";
import { useStore } from "@/state/store";
import { useQuery } from "@tanstack/react-query";

export const ROUTES_QUERY_KEY = ["routes"] as const;

export function useRoutes() {
  const user = useStore((state) => state.user);
  const userIsAuthenticated = useStore((state) => state.userIsAuthenticated);

  return useQuery({
    queryKey: [...ROUTES_QUERY_KEY, user, userIsAuthenticated] as const,
    queryFn: () => zodiosAPI.route_list(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
