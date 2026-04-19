import { zodiosAPI } from "@/api/axiosClient";
import { useQuery } from "@tanstack/react-query";

export const ROUTE_ITEMS_QUERY_KEY = ["routeItem"] as const;

export function useRoute(id: number) {
  return useQuery({
    queryKey: [ROUTE_ITEMS_QUERY_KEY, id],
    queryFn: () => zodiosAPI.getApirouteId({ params: { id } }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    //initialData: [],
  });
}
