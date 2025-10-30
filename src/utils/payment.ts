/**
 * Payment method formatting and visualization utilities
 */

import { Feather } from '@expo/vector-icons';

/**
 * Formats payment method string for display
 * @param value - Payment method value (e.g., "cash_app", "credit_card")
 * @returns Formatted label (e.g., "Cash App", "Credit Card")
 * @example
 * formatPaymentLabel('cash_app') // "Cash App"
 * formatPaymentLabel('credit_card') // "Credit Card"
 * formatPaymentLabel(null) // "Cash"
 */
export function formatPaymentLabel(value: string | null | undefined): string {
  return (value ?? 'cash')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Payment method icon mapping
 */
export const PAYMENT_METHOD_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  cash: 'dollar-sign',
  credit_card: 'credit-card',
  debit_card: 'credit-card',
  venmo: 'send',
  cash_app: 'send',
  zelle: 'send',
  paypal: 'send',
  apple_pay: 'smartphone',
  google_pay: 'smartphone',
  check: 'file-text',
  other: 'more-horizontal',
};

/**
 * Gets appropriate icon for payment method
 * @param method - Payment method string
 * @returns Icon name for Feather icon set
 */
export function getPaymentIcon(method: string | null | undefined): keyof typeof Feather.glyphMap {
  if (!method) return 'dollar-sign';
  return PAYMENT_METHOD_ICONS[method] ?? 'more-horizontal';
}

/**
 * Payment method color themes
 */
export const PAYMENT_METHOD_COLORS = {
  cash: { primary: '#22c55e', light: '#86efac', dark: '#16a34a' },
  credit_card: { primary: '#3b82f6', light: '#93c5fd', dark: '#2563eb' },
  debit_card: { primary: '#3b82f6', light: '#93c5fd', dark: '#2563eb' },
  venmo: { primary: '#3D95CE', light: '#7BB8DB', dark: '#2A6A91' },
  cash_app: { primary: '#00D632', light: '#4DE368', dark: '#00A025' },
  zelle: { primary: '#6D1ED4', light: '#9A5FE3', dark: '#4F15A3' },
  paypal: { primary: '#0070BA', light: '#4D9FD4', dark: '#004F86' },
  apple_pay: { primary: '#000000', light: '#4a4a4a', dark: '#000000' },
  google_pay: { primary: '#4285F4', light: '#7BAAF7', dark: '#2A5BBB' },
  check: { primary: '#6b7280', light: '#9ca3af', dark: '#4b5563' },
  other: { primary: '#6b7280', light: '#9ca3af', dark: '#4b5563' },
};

/**
 * Gets color theme for payment method
 * @param method - Payment method string
 * @param theme - Current app theme colors
 * @returns Payment method visual configuration
 */
export function getPaymentVisuals(
  method: string | null | undefined,
  themeColors: {
    success: string;
    primary: string;
    border: string;
    textSecondary: string;
  }
) {
  const normalizedMethod = method?.toLowerCase() ?? 'cash';
  const colors = PAYMENT_METHOD_COLORS[normalizedMethod as keyof typeof PAYMENT_METHOD_COLORS];

  if (!colors) {
    return {
      icon: 'more-horizontal' as keyof typeof Feather.glyphMap,
      color: themeColors.textSecondary,
      background: `${themeColors.border}20`, // Add transparency
    };
  }

  return {
    icon: getPaymentIcon(normalizedMethod),
    color: colors.primary,
    background: `${colors.light}30`, // Add transparency for background
  };
}

/**
 * Validates payment link URLs
 * @param url - Payment link URL
 * @param method - Payment method type
 * @returns True if valid for the payment method
 */
export function isValidPaymentLink(url: string, method: 'venmo' | 'cashapp' | 'paypal' | 'square'): boolean {
  if (!url) return false;

  const patterns = {
    venmo: /^https?:\/\/(www\.)?venmo\.com\//,
    cashapp: /^https?:\/\/cash\.app\/\$\w+/,
    paypal: /^https?:\/\/(www\.)?paypal\.(com|me)\//,
    square: /^https?:\/\/square\.link\//,
  };

  return patterns[method]?.test(url) ?? false;
}

/**
 * Formats payment amount for display
 * @param cents - Amount in cents
 * @param includeSymbol - Whether to include currency symbol
 * @returns Formatted amount string
 */
export function formatPaymentAmount(cents: number, includeSymbol = true): string {
  const dollars = cents / 100;

  if (includeSymbol) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
  }

  return dollars.toFixed(2);
}