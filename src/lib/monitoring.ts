import type { ComponentType } from 'react';

export const isSentryEnabled = false;

export async function ensureSentry() {
  return null;
}

export async function captureException(error: unknown) {
  console.warn('Sentry disabled; not capturing exception', error);
}

export function withSentryWrap<T extends ComponentType<any>>(Component: T): T {
  return Component;
}
