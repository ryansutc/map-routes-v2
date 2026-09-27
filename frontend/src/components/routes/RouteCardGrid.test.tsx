// @vitest-environment jsdom

import type { RouteListResponseDto } from "@/types/api";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteCardGrid from "./RouteCardGrid";

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

  it("shows a compact labeled duration only when one is present", () => {
    const { rerender } = render(<RouteCardGrid routes={[route(4_800)]} />);
    expect(screen.getByText("Duration: 1h 20m")).toBeTruthy();

    rerender(<RouteCardGrid routes={[route(null)]} />);
    expect(screen.queryByText(/^Duration:/)).toBeNull();
  });
});
