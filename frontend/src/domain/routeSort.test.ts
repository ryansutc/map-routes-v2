import type { RouteListResponseDto } from "@/types/api";
import { describe, expect, it } from "vitest";
import { sortRoutes, type RouteSortField } from "./routeSort";

function route(
  id: number,
  overrides: Partial<RouteListResponseDto> = {},
): RouteListResponseDto {
  return {
    id,
    title: `Route ${id}`,
    activity_type: "Hiking",
    activity_date: "2026-01-01T00:00:00Z",
    distance: 1_000,
    duration: null,
    owner: "route@example.com",
    is_public: false,
    photos: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ids = (routes: RouteListResponseDto[]) => routes.map(({ id }) => id);

describe("route sorting", () => {
  it.each([
    ["title", [route(2, { title: "beta" }), route(1, { title: "Alpha" })]],
    [
      "activity_type",
      [
        route(2, { activity_type: "Running" }),
        route(1, { activity_type: "Hiking" }),
      ],
    ],
    [
      "activity_date",
      [
        route(2, { activity_date: "2026-02-01T00:00:00Z" }),
        route(1, { activity_date: "2026-01-01T00:00:00Z" }),
      ],
    ],
    ["distance", [route(2, { distance: 2_000 }), route(1, { distance: 500 })]],
    [
      "is_public",
      [route(2, { is_public: true }), route(1, { is_public: false })],
    ],
    [
      "created_at",
      [
        route(2, { created_at: "2026-02-01T00:00:00Z" }),
        route(1, { created_at: "2026-01-01T00:00:00Z" }),
      ],
    ],
  ] satisfies [RouteSortField, RouteListResponseDto[]][])(
    "sorts %s by its raw ascending value",
    (field, routes) => {
      expect(ids(sortRoutes(routes, { field, direction: "asc" }))).toEqual([
        1, 2,
      ]);
      expect(ids(sortRoutes(routes, { field, direction: "desc" }))).toEqual([
        2, 1,
      ]);
    },
  );

  it.each(["activity_type", "activity_date"] satisfies RouteSortField[])(
    "keeps missing %s values last in both directions",
    (field) => {
      const missing = route(3, { [field]: null });
      const routes = [missing, route(2), route(1)];

      expect(ids(sortRoutes(routes, { field, direction: "asc" }))).toEqual([
        1, 2, 3,
      ]);
      expect(ids(sortRoutes(routes, { field, direction: "desc" }))).toEqual([
        1, 2, 3,
      ]);
    },
  );

  it("uses route ID ascending as the tie-breaker in both directions", () => {
    const routes = [route(3), route(1), route(2)];

    expect(
      ids(sortRoutes(routes, { field: "distance", direction: "asc" })),
    ).toEqual([1, 2, 3]);
    expect(
      ids(sortRoutes(routes, { field: "distance", direction: "desc" })),
    ).toEqual([1, 2, 3]);
  });

  it("does not mutate the API collection", () => {
    const routes = [route(2, { distance: 2_000 }), route(1, { distance: 500 })];
    sortRoutes(routes, { field: "distance", direction: "asc" });
    expect(ids(routes)).toEqual([2, 1]);
  });
});
