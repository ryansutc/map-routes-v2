import { zodiosAPI } from "@/api/axiosClient";
import { useQuery } from "@tanstack/react-query";

export const routeQueryKey = (id: number) => ["route", id] as const;

export function useRoute(id: number) {
  return useQuery({
    queryKey: routeQueryKey(id),
    queryFn: () => zodiosAPI.route_retrieve({ params: { id } }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
