// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "@/state/store";

import MainWrapper from "./MainWrapper";

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
}));

vi.mock("@/api/axiosClient", () => ({
  zodiosAPI: {
    auth_status_retrieve: mocks.getAuthStatus,
  },
}));

function renderMainWrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MainWrapper>{children}</MainWrapper>
    </QueryClientProvider>,
  );
}

describe("MainWrapper authentication startup", () => {
  beforeEach(() => {
    mocks.getAuthStatus.mockReset();
    localStorage.clear();
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("email", "route@example.com");
    useStore.setState({
      user: "route@example.com",
      userIsAuthenticated: undefined,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("treats a rejected stored token as a signed-out session", async () => {
    mocks.getAuthStatus.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: { status: 401 },
    });

    renderMainWrapper({ children: <div>Public routes</div> });

    await waitFor(() => {
      expect(useStore.getState()).toMatchObject({
        user: null,
        userIsAuthenticated: false,
      });
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(screen.getByText("Public routes")).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it("keeps unexpected startup failures distinguishable", async () => {
    mocks.getAuthStatus.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 500",
      response: { status: 500 },
    });

    renderMainWrapper({ children: <div>Public routes</div> });

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("expired-token");
    expect(localStorage.getItem("email")).toBe("route@example.com");
    expect(useStore.getState()).toMatchObject({
      user: "route@example.com",
      userIsAuthenticated: undefined,
    });
  });
});
