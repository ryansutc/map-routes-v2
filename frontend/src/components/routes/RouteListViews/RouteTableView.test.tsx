// @vitest-environment jsdom

import type { RouteSort } from "@/domain/routeSort";
import type { RouteListResponseDto } from "@/types/api";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteTableView from "./RouteTableView";

const dataGrid = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock("@mui/x-data-grid", () => ({
  DataGrid: (props: Record<string, unknown>) => {
    dataGrid.props = props;
    return (
      <button
        onClick={() =>
          (props.onSortModelChange as (model: unknown[]) => void)([
            { field: "title", sort: "asc" },
          ])
        }
      >
        sort Title
      </button>
    );
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

function routes(count: number): RouteListResponseDto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Route ${index + 1}`,
    activity_type: "Hiking",
    activity_date: "2026-01-01T00:00:00Z",
    distance: 1_000,
    duration: null,
    owner: "route@example.com",
    is_public: true,
    photos: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }));
}

describe("RouteTableView", () => {
  afterEach(cleanup);

  it("controls Data Grid sorting and forwards its single-column updates", () => {
    const sort: RouteSort = { field: "activity_date", direction: "desc" };
    const onSortChange = vi.fn();
    render(
      <RouteTableView
        routes={routes(2)}
        sort={sort}
        onSortChange={onSortChange}
      />,
    );

    expect(dataGrid.props.sortModel).toEqual([
      { field: "activity_date", sort: "desc" },
    ]);
    expect(dataGrid.props.sortingMode).toBe("server");
    expect(dataGrid.props.sortingOrder).toEqual(["asc", "desc"]);

    fireEvent.click(screen.getByRole("button", { name: "sort Title" }));
    expect(onSortChange).toHaveBeenCalledWith({
      field: "title",
      direction: "asc",
    });
  });

  it("uses a 100-row page and only shows the footer for larger collections", () => {
    const sort: RouteSort = { field: "activity_date", direction: "desc" };
    const { rerender } = render(
      <RouteTableView
        routes={routes(100)}
        sort={sort}
        onSortChange={vi.fn()}
      />,
    );

    expect(dataGrid.props.initialState).toEqual({
      pagination: { paginationModel: { page: 0, pageSize: 100 } },
    });
    expect(dataGrid.props.hideFooter).toBe(true);

    rerender(
      <RouteTableView
        routes={routes(101)}
        sort={sort}
        onSortChange={vi.fn()}
      />,
    );
    expect(dataGrid.props.hideFooter).toBe(false);
  });
});
