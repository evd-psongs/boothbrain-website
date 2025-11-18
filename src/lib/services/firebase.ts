// NOTE: Firebase Crashlytics works in production builds (EAS/TestFlight).
// In Expo Go, Firebase is not available and these functions log to console instead.

// Conditionally import Firebase Crashlytics
// In Expo Go, this will be undefined; in production builds, it will be the real module
let crashlytics: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch {
  // Firebase not available (Expo Go)
  crashlytics = null;
}

/**
 * Initialize Firebase Crashlytics
 * Gracefully handles Expo Go environment where Firebase is not available
 */
export const initializeCrashlytics = async () => {
  if (!crashlytics) {
    console.log('[Dev] Crashlytics not available in Expo Go - will work in production builds');
    return;
  }

  try {
    await crashlytics().setCrashlyticsCollectionEnabled(true);
    console.log('✅ Firebase Crashlytics initialized');
  } catch (error) {
    console.error('Error initializing Crashlytics:', error);
  }
};

/**
 * Log a custom event to Crashlytics
 */
export const logCrashlyticsEvent = (message: string) => {
  if (!crashlytics) {
    console.log('[Dev] Crashlytics Event:', message);
    return;
  }

  try {
    crashlytics().log(message);
  } catch (error) {
    console.error('Error logging event:', error);
  }
};

/**
 * Record a non-fatal error
 */
export const recordError = (error: Error, errorInfo?: any) => {
  if (!crashlytics) {
    console.error('[Dev] Error to report:', error, errorInfo);
    return;
  }

  try {
    crashlytics().recordError(error);
  } catch (err) {
    console.error('Error recording crash:', err);
  }
};

/**
 * Set custom attributes for the user
 */
export const setUserAttributes = (attributes: Record<string, string | number | boolean>) => {
  if (!crashlytics) {
    console.log('[Dev] User Attributes:', attributes);
    return;
  }

  try {
    Object.entries(attributes).forEach(([key, value]) => {
      crashlytics().setAttribute(key, String(value));
    });
  } catch (error) {
    console.error('Error setting attributes:', error);
  }
};

/**
 * Set user identifier
 */
export const setUserId = (userId: string) => {
  if (!crashlytics) {
    console.log('[Dev] User ID:', userId);
    return;
  }

  try {
    crashlytics().setUserId(userId);
  } catch (error) {
    console.error('Error setting user ID:', error);
  }
};

/**
 * Force a crash for testing
 * WARNING: Only use in development/testing!
 */
export const testCrash = () => {
  if (!crashlytics) {
    console.log('[Dev] Test crash not available in Expo Go');
    return;
  }

  try {
    crashlytics().crash();
  } catch (error) {
    console.error('Error triggering crash:', error);
  }
};