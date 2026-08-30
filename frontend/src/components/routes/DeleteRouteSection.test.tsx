// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeQueryKey } from "@/hooks/useRoute";
import { useToastStore } from "@/store/toastStore";

import { DeleteRouteSection } from "./DeleteRouteSection";

const mocks = vi.hoisted(() => ({
  beforeNavigate: vi.fn(),
  deleteRoute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/api/axiosClient", () => ({
  zodiosAPI: {
    route_destroy: mocks.deleteRoute,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

const route = {
  id: 42,
  title: "Morning Ridge",
  activity_type: "Hiking",
  notes: "",
  is_public: true,
  owner: "owner@example.com",
  activity_date: "2025-04-12T09:00:00Z",
  distance: 12.5,
  duration: 3600,
  avg_pace: 5.2,
  elevation_gain: 400,
};

function renderDeleteSection(isOwner = true) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(routeQueryKey(42), route);
  queryClient.setQueryData(["routes"], [route]);

  render(
    <QueryClientProvider client={queryClient}>
      <DeleteRouteSection
        routeId={42}
        routeTitle="Morning Ridge"
        isOwner={isOwner}
        onBeforeNavigate={mocks.beforeNavigate}
      />
    </QueryClientProvider>,
  );

  return queryClient;
}

describe("Edit Route deletion", () => {
  beforeEach(() => {
    mocks.beforeNavigate.mockReset();
    mocks.deleteRoute.mockReset();
    mocks.navigate.mockReset();
    useToastStore.setState({ toasts: [] });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the danger section only to the owner and canceling makes no request", async () => {
    renderDeleteSection();

    fireEvent.click(await screen.findByRole("button", { name: "Delete route" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Morning Ridge/)).toBeTruthy();
    expect(within(dialog).getByText(/track, and photos.*permanently removed/i)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(mocks.deleteRoute).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    cleanup();
    renderDeleteSection(false);
    expect(screen.queryByRole("button", { name: "Delete route" })).toBeNull();
  });

  it("prevents duplicate confirmation and handles successful deletion", async () => {
    let resolveDelete: (() => void) | undefined;
    mocks.deleteRoute.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const queryClient = renderDeleteSection();

    fireEvent.click(await screen.findByRole("button", { name: "Delete route" }));
    const confirm = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete route",
    });
    act(() => {
      confirm.click();
      confirm.click();
    });

    await waitFor(() => expect(confirm).toHaveProperty("disabled", true));
    expect(mocks.deleteRoute).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRoute).toHaveBeenCalledWith(undefined, { params: { id: 42 } });

    await act(async () => resolveDelete?.());
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/routes" }));
    expect(mocks.beforeNavigate).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(routeQueryKey(42))).toBeUndefined();
    expect(queryClient.getQueryState(["routes"])?.isInvalidated).toBe(true);
    expect(useToastStore.getState().toasts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Route deleted", severity: "success" }),
      ]),
    );
  });

  it("leaves the owner on the edit page and shows an error when deletion fails", async () => {
    mocks.deleteRoute.mockRejectedValue({
      message: "Request failed with status code 503",
      response: { data: { detail: "Hosted service unavailable." } },
    });
    const queryClient = renderDeleteSection();

    fireEvent.click(await screen.findByRole("button", { name: "Delete route" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete route" }),
    );

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert.textContent).toContain("Hosted service unavailable.");
    expect(alert.textContent).toContain("Please try again.");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(routeQueryKey(42))).toEqual(route);
  });
});
