import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Initialize Firebase Crashlytics
 */
export const initializeCrashlytics = async () => {
  try {
    // Enable Crashlytics collection (can be disabled in development if needed)
    await crashlytics().setCrashlyticsCollectionEnabled(true);

    // You can set user identifiers if you have user authentication
    // This helps identify which users are experiencing crashes
    // crashlytics().setUserId('user123');

    console.log('Firebase Crashlytics initialized');
  } catch (error) {
    console.error('Error initializing Crashlytics:', error);
  }
};

/**
 * Log a custom event to Crashlytics
 */
export const logCrashlyticsEvent = (message: string) => {
  crashlytics().log(message);
};

/**
 * Record a non-fatal error
 */
export const recordError = (error: Error, errorInfo?: any) => {
  crashlytics().recordError(error, errorInfo);
};

/**
 * Set custom attributes for the user
 */
export const setUserAttributes = (attributes: Record<string, string | number | boolean>) => {
  Object.entries(attributes).forEach(([key, value]) => {
    crashlytics().setAttribute(key, String(value));
  });
};

/**
 * Set user identifier (useful after login)
 */
export const setUserId = (userId: string) => {
  crashlytics().setUserId(userId);
};

/**
 * Force a crash (for testing purposes only!)
 */
export const testCrash = () => {
  crashlytics().crash();
};