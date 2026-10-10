/**
 * Format a Duration string for routes based on total seconds of activity
 *
 * @param totalSeconds total seconds of activity
 * @returns string like: 12h 34m or 45m.
 */
export function formatCompactDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
