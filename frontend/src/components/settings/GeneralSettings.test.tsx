// @vitest-environment jsdom

import { useStore } from "@/state/store";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeneralSettings } from "./GeneralSettings";

describe("GeneralSettings", () => {
  beforeEach(() => {
    useStore.setState({ units: "metric" });
  });

  afterEach(cleanup);

  it("describes the units setting and updates its helper text", async () => {
    render(<GeneralSettings />);

    expect(screen.getByRole("button", { name: "metric" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "imperial" })).toBeTruthy();
    expect(
      screen.getByText("use meters (m) and kilometers (km) in app."),
    ).toBeTruthy();

    fireEvent.mouseOver(screen.getByRole("group", { name: "Distance units" }));
    expect(
      await screen.findByRole("tooltip", {
        name: "Show distances and elevations in appropriate units",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "imperial" }));

    expect(useStore.getState().units).toBe("imperial");
    expect(
      screen.getByText("use feet (ft) and miles (mi) in app."),
    ).toBeTruthy();
  });

  it("toggles dark mode and persists the preference", async () => {
    useStore.setState({ themeMode: "light" });
    render(<GeneralSettings />);

    const darkMode = screen.getByRole("switch", { name: "Dark mode" });
    expect((darkMode as HTMLInputElement).checked).toBe(false);
    expect(
      screen.getByText("Use a darker color scheme throughout the app."),
    ).toBeTruthy();

    fireEvent.click(darkMode);

    expect(useStore.getState().themeMode).toBe("dark");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem("map-routes-store")).toContain(
      '"themeMode":"dark"',
    );
  });
});
