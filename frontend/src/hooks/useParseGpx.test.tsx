// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import { useParseGpx } from "./useParseGpx";

const mocks = vi.hoisted(() => ({
  parseGpx: vi.fn(),
}));

vi.mock("@/api/axiosClient", () => ({
  zodiosAPI: {
    route_parse_gpx_create: mocks.parseGpx,
  },
}));

describe("useParseGpx", () => {
  it("uses a 10 second timeout for GPX parsing", async () => {
    mocks.parseGpx.mockResolvedValue({});
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useParseGpx(), { wrapper });
    const file = new File(["<gpx />"], "route.gpx", {
      type: "application/gpx+xml",
    });

    await act(() => result.current.mutateAsync(file));

    expect(mocks.parseGpx).toHaveBeenCalledWith(
      { file },
      { timeout: 10_000 },
    );
  });
});
