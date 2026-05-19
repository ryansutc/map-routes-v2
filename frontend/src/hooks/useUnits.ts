import { createContext, useContext } from "react";

export type UnitSystem = "metric" | "imperial";

const STORAGE_KEY = "map-routes-units";

export function getStoredUnits(): UnitSystem {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "imperial" || v === "metric") return v;
  } catch {
    // ignore
  }
  return "metric";
}

export function setStoredUnits(units: UnitSystem): void {
  try {
    localStorage.setItem(STORAGE_KEY, units);
  } catch {
    // ignore
  }
}

export type UnitsContextValue = {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
};

export const UnitsContext = createContext<UnitsContextValue>({
  units: "metric",
  setUnits: () => {},
});

export function useUnits(): UnitsContextValue {
  return useContext(UnitsContext);
}

// Display helpers
export function formatDistance(meters: number, units: UnitSystem): string {
  if (units === "imperial") {
    return `${(meters / 1609.344).toFixed(2)} mi`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatElevation(m: number | null, units: UnitSystem): string {
  if (m === null) return "—";
  if (units === "imperial") {
    return `${(m * 3.28084).toFixed(0)} ft`;
  }
  return `${m.toFixed(0)} m`;
}

export function formatPace(
  paceMinPerKm: number | null,
  units: UnitSystem,
): string {
  if (paceMinPerKm === null) return "—";
  if (units === "imperial") {
    const paceMinPerMi = paceMinPerKm * 1.60934;
    return `${paceMinPerMi.toFixed(2)} min/mi`;
  }
  return `${paceMinPerKm.toFixed(2)} min/km`;
}
