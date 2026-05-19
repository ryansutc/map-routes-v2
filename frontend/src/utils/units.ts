export type UnitSystem = "metric" | "imperial";

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
