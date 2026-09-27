// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "@/state/store";

import AppShell from "./AppShell";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/api/axiosClient", () => ({
  zodiosAPI: {
    auth_logout_create: mocks.logout,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: PropsWithChildren) => <span>{children}</span>,
  useNavigate: () => mocks.navigate,
}));

describe("AppShell sign out", () => {
  beforeEach(() => {
    mocks.logout.mockReset();
    mocks.navigate.mockReset();
    localStorage.clear();
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("email", "route@example.com");
    useStore.setState({
      user: "route@example.com",
      userIsAuthenticated: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clears client credentials when logout rejects an expired token", async () => {
    mocks.logout.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: { status: 401 },
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>Routes</AppShell>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(await screen.findByText("Sign out"));

    await waitFor(() => {
      expect(useStore.getState()).toMatchObject({
        user: null,
        userIsAuthenticated: false,
      });
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("email")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/routes" });
  });

  it("retains client credentials when logout fails unexpectedly", async () => {
    mocks.logout.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 500",
      response: { status: 500 },
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>Routes</AppShell>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(await screen.findByText("Sign out"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign-out failed. Please try again.",
    );
    expect(localStorage.getItem("token")).toBe("expired-token");
    expect(localStorage.getItem("email")).toBe("route@example.com");
    expect(useStore.getState()).toMatchObject({
      user: "route@example.com",
      userIsAuthenticated: true,
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("opens shared settings at General for signed-out users", async () => {
    useStore.setState({
      user: null,
      userIsAuthenticated: false,
      units: "metric",
    });
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>Routes</AppShell>
      </QueryClientProvider>,
    );

    expect(screen.queryByText("km")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "General" })).toBeTruthy();
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "imperial" }));
    expect(useStore.getState().units).toBe("imperial");
    await waitFor(() =>
      expect(localStorage.getItem("map-routes-store")).toContain(
        '"units":"imperial"',
      ),
    );
  });
});
