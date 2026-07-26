export type UnitSystem = "metric" | "imperial";

export function formatDistance(meters: number, units: UnitSystem): string {
  if (units === "imperial") {
    return `${(meters / 1609.344).toFixed(2)} mi`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export const METERS_PER_UNIT: Record<UnitSystem, number> = {
  metric: 1000,
  imperial: 1609.344,
};

/** Nice round step (in km/mi) so an axis of `total` meters gets ~4-8 ticks. */
export function niceDistanceStep(
  totalMeters: number,
  units: UnitSystem,
): number {
  const total = totalMeters / METERS_PER_UNIT[units];
  if (!Number.isFinite(total) || total <= 0) return 1;
  const raw = total / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Axis domain (in meters) rounded up to the next whole step, plus the tick
 * positions at each round km/mi.
 */
export function distanceAxisTicks(
  totalMeters: number,
  units: UnitSystem,
): { max: number; ticks: number[] } {
  const perUnit = METERS_PER_UNIT[units];
  const step = niceDistanceStep(totalMeters, units);
  const total = totalMeters / perUnit;
  const count = Math.max(1, Math.ceil(total / step - 1e-9));
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Number((i * step * perUnit).toFixed(6)));
  }
  return { max: count * step * perUnit, ticks };
}

/** Compact axis label: drops trailing zeros ("2 km", "0.5 mi"). */
export function formatDistanceTick(meters: number, units: UnitSystem): string {
  const value = meters / METERS_PER_UNIT[units];
  const label = Number(value.toFixed(2)).toString();
  return `${label} ${units === "imperial" ? "mi" : "km"}`;
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
