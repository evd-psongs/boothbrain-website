export function isPauseAllowanceUsed(
  currentPeriodStart: string | null | undefined,
  pauseUsedPeriodStart: string | null | undefined,
): boolean {
  if (!pauseUsedPeriodStart) return false;

  const pauseMs = Date.parse(pauseUsedPeriodStart);
  if (Number.isNaN(pauseMs)) {
    return false;
  }

  if (!currentPeriodStart) {
    // Without a current period start we err on the side of blocking a second pause.
    return true;
  }

  const currentMs = Date.parse(currentPeriodStart);
  if (Number.isNaN(currentMs)) {
    return true;
  }

  return pauseMs === currentMs;
}
