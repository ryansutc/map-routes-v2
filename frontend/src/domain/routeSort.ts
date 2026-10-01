import type { RouteListResponseDto } from "@/types/api";

export const ROUTE_SORT_FIELDS = [
  "title",
  "activity_type",
  "activity_date",
  "distance",
  "is_public",
  "created_at",
] as const;

export type RouteSortField = (typeof ROUTE_SORT_FIELDS)[number];
export type RouteSortDirection = "asc" | "desc";

export type RouteSort = {
  field: RouteSortField;
  direction: RouteSortDirection;
};

export const DEFAULT_ROUTE_SORT: RouteSort = {
  field: "activity_date",
  direction: "desc",
};

export const ROUTE_SORT_LABELS: Record<RouteSortField, string> = {
  title: "Title",
  activity_type: "Activity",
  activity_date: "Date",
  distance: "Distance",
  is_public: "Visibility",
  created_at: "Uploaded",
};

const isMissing = (field: RouteSortField, value: unknown) =>
  (field === "activity_type" || field === "activity_date") &&
  (value == null || (typeof value === "string" && value.trim() === ""));

function comparePopulatedValues(
  a: RouteListResponseDto,
  b: RouteListResponseDto,
  field: RouteSortField,
) {
  switch (field) {
    case "title":
    case "activity_type":
      return (a[field] ?? "").localeCompare(b[field] ?? "", undefined, {
        sensitivity: "base",
      });
    case "activity_date":
    case "created_at":
      return (
        new Date(a[field] as string).getTime() -
        new Date(b[field] as string).getTime()
      );
    case "distance":
      return a.distance - b.distance;
    case "is_public":
      return Number(Boolean(a.is_public)) - Number(Boolean(b.is_public));
  }
}

export function compareRoutes(
  a: RouteListResponseDto,
  b: RouteListResponseDto,
  { field, direction }: RouteSort,
) {
  const aValue = a[field];
  const bValue = b[field];
  const aMissing = isMissing(field, aValue);
  const bMissing = isMissing(field, bValue);

  // Missing values stay at the end instead of being reversed with the sort.
  if (aMissing !== bMissing) return aMissing ? 1 : -1;

  const comparison = aMissing ? 0 : comparePopulatedValues(a, b, field);
  if (comparison !== 0) return direction === "asc" ? comparison : -comparison;

  return a.id - b.id;
}

export function sortRoutes(routes: RouteListResponseDto[], sort: RouteSort) {
  return [...routes].sort((a, b) => compareRoutes(a, b, sort));
}

export function isRouteSortField(field: string): field is RouteSortField {
  return ROUTE_SORT_FIELDS.some((candidate) => candidate === field);
}
