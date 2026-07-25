export interface ShouldUpdateProgressParams {
  now: number;
  lastUpdateTime: number;
  lastProgress: number;
  nextProgress: number;
  intervalMs: number;
  threshold: number;
}

export function shouldUpdateProgress({
  now,
  lastUpdateTime,
  lastProgress,
  nextProgress,
  intervalMs,
  threshold,
}: ShouldUpdateProgressParams): boolean {
  const elapsed = now - lastUpdateTime;
  const progressDelta = Math.abs(nextProgress - lastProgress);

  return elapsed >= intervalMs || progressDelta >= threshold;
}
