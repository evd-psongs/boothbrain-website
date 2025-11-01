// NOTE: Firebase Crashlytics requires a development build and cannot run in Expo Go.
// This is a temporary mock implementation to allow the app to run in Expo Go.
// To use real Firebase Crashlytics:
// 1. Create a development build: npx expo run:android or npx expo run:ios
// 2. Uncomment the real implementation below and comment out the mock

// ===== MOCK IMPLEMENTATION FOR EXPO GO =====
/**
 * Initialize Firebase Crashlytics (MOCK for Expo Go)
 */
export const initializeCrashlytics = async () => {
  console.log('[Mock] Firebase Crashlytics would be initialized in a development build');
};

/**
 * Log a custom event to Crashlytics (MOCK for Expo Go)
 */
export const logCrashlyticsEvent = (message: string) => {
  console.log('[Mock] Crashlytics Event:', message);
};

/**
 * Record a non-fatal error (MOCK for Expo Go)
 */
export const recordError = (error: Error, errorInfo?: any) => {
  console.error('[Mock] Crashlytics Error:', error, errorInfo);
};

/**
 * Set custom attributes for the user (MOCK for Expo Go)
 */
export const setUserAttributes = (attributes: Record<string, string | number | boolean>) => {
  console.log('[Mock] Crashlytics User Attributes:', attributes);
};

/**
 * Set user identifier (MOCK for Expo Go)
 */
export const setUserId = (userId: string) => {
  console.log('[Mock] Crashlytics User ID:', userId);
};

/**
 * Force a crash (MOCK for Expo Go)
 */
export const testCrash = () => {
  console.log('[Mock] Test crash would be triggered in a development build');
};

// ===== REAL IMPLEMENTATION FOR DEVELOPMENT BUILD =====
// Uncomment the code below when using a development build:

/*
import crashlytics from '@react-native-firebase/crashlytics';

export const initializeCrashlytics = async () => {
  try {
    await crashlytics().setCrashlyticsCollectionEnabled(true);
    console.log('Firebase Crashlytics initialized');
  } catch (error) {
    console.error('Error initializing Crashlytics:', error);
  }
};

export const logCrashlyticsEvent = (message: string) => {
  crashlytics().log(message);
};

export const recordError = (error: Error, errorInfo?: any) => {
  crashlytics().recordError(error, errorInfo);
};

export const setUserAttributes = (attributes: Record<string, string | number | boolean>) => {
  Object.entries(attributes).forEach(([key, value]) => {
    crashlytics().setAttribute(key, String(value));
  });
};

export const setUserId = (userId: string) => {
  crashlytics().setUserId(userId);
};

export const testCrash = () => {
  crashlytics().crash();
};
*/