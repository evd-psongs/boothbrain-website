const PAUSE_ALREADY_USED_HINTS = ['pause already used', 'pause has already been used', 'pause allowance used'];

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

  return message;
}
