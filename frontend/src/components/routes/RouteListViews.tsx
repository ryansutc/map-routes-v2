import {
  DEFAULT_ROUTE_SORT,
  sortRoutes,
  type RouteSort,
} from "@/domain/routeSort";
import type { RouteListResponseDto } from "@/types/api";
import { useMemo, useState } from "react";
import RouteCardGrid from "./RouteCardGrid";
import RouteTableView from "./RouteTableView";

export default function RouteListViews({
  routes,
  isLoading,
  listView,
}: {
  routes: RouteListResponseDto[];
  isLoading?: boolean;
  listView: "cards" | "table";
}) {
  const [sort, setSort] = useState<RouteSort>(DEFAULT_ROUTE_SORT);
  const sortedRoutes = useMemo(() => sortRoutes(routes, sort), [routes, sort]);

  return listView === "table" ? (
    <RouteTableView
      routes={sortedRoutes}
      isLoading={isLoading}
      sort={sort}
      onSortChange={setSort}
    />
  ) : (
    <RouteCardGrid
      routes={sortedRoutes}
      isLoading={isLoading}
      sort={sort}
      onSortChange={setSort}
    />
  );
}
