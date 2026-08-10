// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ElevationProfile from "./ElevationProfile";
import type { ProfilePoint } from "@/hooks/useElevationProfile";
import { routeAnimationProgress } from "@/state/routeAnimationProgress";

const { lineChartRender } = vi.hoisted(() => ({
  lineChartRender: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  LineChart: ({ children }: { children: ReactNode }) => {
    lineChartRender();
    return <div data-testid="static-line-chart">{children}</div>;
  },
  Line: () => null,
  ReferenceDot: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const profilePoints: ProfilePoint[] = [
  { distance: 0, elevation: 100, lon: -123, lat: 49 },
  { distance: 25, elevation: 300, lon: -122.75, lat: 49.25 },
  { distance: 100, elevation: 200, lon: -122, lat: 50 },
];

describe("ElevationProfile animation cursor", () => {
  beforeEach(() => {
    lineChartRender.mockClear();
    routeAnimationProgress.reset();
  });

  afterEach(cleanup);

  it("moves from full-resolution distance data without rerendering the static chart", () => {
    const { unmount } = render(
      <ElevationProfile
        profilePoints={profilePoints}
        hasElevation
        onHover={vi.fn()}
        onHoverEnd={vi.fn()}
        isAnimating
      />,
    );

    expect(lineChartRender).toHaveBeenCalledOnce();

    act(() => routeAnimationProgress.publish(0.5));

    const cursor = screen.getByTestId("elevation-animation-cursor");
    expect(Number(cursor.dataset.distanceProgress)).toBe(0.5);
    expect(Number(cursor.dataset.elevation)).toBeCloseTo(266.667, 3);
    expect(lineChartRender).toHaveBeenCalledOnce();

    unmount();
  });

  it("parks at completion, clears on stop, and restores hover afterward", () => {
    const onHoverEnd = vi.fn();
    const props = {
      profilePoints,
      hasElevation: true,
      onHover: vi.fn(),
      onHoverEnd,
    };
    const { rerender } = render(<ElevationProfile {...props} />);

    expect(screen.queryByTestId("elevation-animation-cursor")).toBeNull();

    rerender(<ElevationProfile {...props} isAnimating />);

    expect(onHoverEnd).toHaveBeenCalledOnce();
    expect(screen.getByTestId("elevation-hover-blocker")).toBeTruthy();

    act(() => routeAnimationProgress.publish(1));
    rerender(<ElevationProfile {...props} />);

    expect(screen.getByTestId("elevation-animation-cursor")).toBeTruthy();
    expect(screen.queryByTestId("elevation-hover-blocker")).toBeNull();

    act(() => routeAnimationProgress.reset());

    expect(screen.queryByTestId("elevation-animation-cursor")).toBeNull();
  });
});
