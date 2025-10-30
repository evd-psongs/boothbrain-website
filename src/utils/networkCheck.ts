import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

/**
 * Quick network connectivity check for iOS to prevent hanging
 * Returns true if network is reachable, false otherwise
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !__DEV__) {
    return true; // Only check on iOS in development
  }

  if (!SUPABASE_URL) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s quick check

    const response = await fetch(`${SUPABASE_URL}/health`, {
      method: 'HEAD',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    return response.ok || response.status === 404; // 404 is ok, means server is reachable
  } catch {
    // Network is not reachable
    return false;
  }
}

/**
 * Delay utility for retries
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is a network timeout
 */
export const isTimeoutError = (error: any): boolean => {
  return error?.message?.includes('Timed out') ||
         error?.message?.includes('timeout') ||
         error?.message?.includes('aborted');
};