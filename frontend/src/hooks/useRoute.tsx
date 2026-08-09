import { zodiosAPI } from "@/api/axiosClient";
import { useQuery } from "@tanstack/react-query";

/**
 * Creates the shared TanStack Query cache key for a route detail record.
 * Used by route queries and route-editing mutations that invalidate cached data.
 *
 * @param id - Database ID of the route.
 */
export const routeQueryKey = (id: number) => ["route", id] as const;

/**
 * Fetches and caches one route for the detail and route-editing screens.
 *
 * @param id - Database ID of the route to retrieve.
 */
export function useRoute(id: number) {
  return useQuery({
    queryKey: routeQueryKey(id),
    queryFn: () => zodiosAPI.route_retrieve({ params: { id } }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
