// @vitest-environment jsdom

import type { RouteListResponseDto } from "@/types/api";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteCardGrid from "./RouteCardGrid";
import type { RouteSort } from "@/domain/routeSort";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

function route(duration: number | null): RouteListResponseDto {
  return {
    id: duration == null ? 1 : 2,
    title: "Mountain route",
    activity_type: "Hiking",
    distance: 12_000,
    duration,
    owner: "route@example.com",
    is_public: true,
    photos: [],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

describe("RouteCardGrid", () => {
  afterEach(cleanup);

  const sort: RouteSort = { field: "activity_date", direction: "desc" };

  it("shows a compact labeled duration only when one is present", () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <RouteCardGrid
        routes={[route(4_800)]}
        sort={sort}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByText("Duration: 1h 20m")).toBeTruthy();

    rerender(
      <RouteCardGrid
        routes={[route(null)]}
        sort={sort}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.queryByText(/^Duration:/)).toBeNull();
  });

  it("offers every sort field and resets a new field to ascending", () => {
    const onSortChange = vi.fn();
    render(
      <RouteCardGrid
        routes={[route(null)]}
        sort={sort}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort by" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "Title",
      "Activity",
      "Date",
      "Distance",
      "Visibility",
      "Uploaded",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Distance" }));

    expect(onSortChange).toHaveBeenCalledWith({
      field: "distance",
      direction: "asc",
    });
  });

  it("exposes an accessible direction toggle", () => {
    const onSortChange = vi.fn();
    render(
      <RouteCardGrid
        routes={[route(null)]}
        sort={sort}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    expect(onSortChange).toHaveBeenCalledWith({
      field: "activity_date",
      direction: "asc",
    });
  });
});
