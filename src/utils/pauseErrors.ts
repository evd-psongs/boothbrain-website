const PAUSE_ALREADY_USED_HINTS = ['pause already used', 'pause has already been used', 'pause allowance used'];
const PAUSE_ALREADY_ACTIVE_HINTS = ['subscription is already paused', 'already paused'];
const PAUSE_NOT_ACTIVE_HINTS = ['subscription is not paused', 'not paused'];

export const PAUSE_ALREADY_USED_MESSAGE =
  'You already used your pause for this billing cycle. You can pause again after the next billing date.';

export function mapPauseErrorMessage(message: string | null | undefined): string {
  if (!message || !message.trim()) {
    return 'Unexpected error';
  }

  const normalized = message.toLowerCase();
  if (PAUSE_ALREADY_USED_HINTS.some((hint) => normalized.includes(hint))) {
    return PAUSE_ALREADY_USED_MESSAGE;
  }
  if (PAUSE_ALREADY_ACTIVE_HINTS.some((hint) => normalized.includes(hint))) {
    return 'Your subscription is already paused.';
  }
  if (PAUSE_NOT_ACTIVE_HINTS.some((hint) => normalized.includes(hint))) {
    return 'Your subscription is not currently paused.';
  }

  return message;
}
