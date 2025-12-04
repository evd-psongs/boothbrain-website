import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Check if Apple IAP is available
 */
export function isAppleIAPAvailable(): boolean {
  return isIOS;
}

/**
 * Check if Google Play Billing is available
 * Currently disabled - will enable in Phase 2 (Android monetization)
 */
export function isGooglePlayAvailable(): boolean {
  // Phase 2: Change to `return isAndroid;` when Google Play Billing is implemented
  return false;
}

/**
 * Check if Pro subscriptions are available on this platform
 * Phase 1: iOS only
 * Phase 2: Will add Android
 */
export function isProSubscriptionAvailable(): boolean {
  // Phase 1: iOS only
  if (isIOS) return true;

  // Phase 2: Enable Android (uncomment when Google Play Billing is ready)
  // if (isAndroid) return true;

  return false;
}

/**
 * Check if Stripe checkout is available
 * Currently disabled on mobile to enforce platform-native payments
 * Can be used for web version in the future
 */
export function isStripeAvailable(): boolean {
  // For now, disable Stripe on all platforms
  // iOS requires Apple IAP, Android will require Google Play
  // Future: Enable for web version
  return false;
}

/**
 * Get subscription provider name for current platform
 */
export function getPaymentProvider(): 'apple' | 'google' | 'stripe' | 'none' {
  if (isIOS) return 'apple';
  if (isAndroid) return 'none'; // Phase 2: Change to 'google' when ready
  return 'stripe'; // Web fallback (future)
}

/**
 * Get user-friendly message for why Pro isn't available
 */
export function getProUnavailableMessage(): string {
  if (isAndroid) {
    return 'Pro subscriptions coming soon to Android! We\'re working on bringing all Pro features to Android users.';
  }
  if (isWeb) {
    return 'Pro subscriptions are available on iOS and Android apps. Download the app to subscribe.';
  }
  return 'Pro subscriptions are not available on this platform.';
}
