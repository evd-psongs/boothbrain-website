export function formatCurrencyFromCents(
  cents: number | null | undefined,
  currency: string | null | undefined,
  locale: string = 'en-US',
): string {
  if (typeof cents !== 'number') {
    return '—';
  }

  const amount = cents / 100;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(amount);
}
