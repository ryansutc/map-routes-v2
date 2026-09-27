// @vitest-environment jsdom

import type { RouteSort } from "@/domain/routeSort";
import type { RouteListResponseDto } from "@/types/api";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteListViews from "./RouteListViews";

vi.mock("./RouteCardGrid", () => ({
  default: ({
    sort,
    onSortChange,
  }: {
    sort: RouteSort;
    onSortChange: (sort: RouteSort) => void;
  }) => (
    <div>
      <span>
        cards:{sort.field}:{sort.direction}
      </span>
      <button
        onClick={() => onSortChange({ field: "distance", direction: "asc" })}
      >
        change card sort
      </button>
    </div>
  ),
}));

vi.mock("./RouteTableView", () => ({
  default: ({ sort }: { sort: RouteSort }) => (
    <span>
      table:{sort.field}:{sort.direction}
    </span>
  ),
}));

const routes: RouteListResponseDto[] = [];

describe("RouteListViews", () => {
  afterEach(cleanup);

  it("starts at Date descending and preserves sort across view and route-set changes", () => {
    const { rerender } = render(
      <RouteListViews routes={routes} listView="cards" />,
    );
    expect(screen.getByText("cards:activity_date:desc")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "change card sort" }));
    rerender(<RouteListViews routes={routes} listView="table" />);
    expect(screen.getByText("table:distance:asc")).toBeTruthy();

    rerender(<RouteListViews routes={[]} listView="cards" />);
    expect(screen.getByText("cards:distance:asc")).toBeTruthy();
  });
});
