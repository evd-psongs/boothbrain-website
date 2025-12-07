import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveSession } from '@/types/session';

const SESSION_STORAGE_KEY = 'boothbrain_current_session';
const SESSION_EXPIRY_MINUTES = 30; // Session expires after 30 minutes of inactivity

/**
 * Validates if a session has expired
 * @param session The session to validate
 * @returns True if the session is still valid (within 30 minutes of creation)
 */
export function isSessionValid(session: ActiveSession): boolean {
  const createdAt = new Date(session.createdAt);
  const minutesElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60);
  return minutesElapsed <= SESSION_EXPIRY_MINUTES;
}

/**
 * Persists a session to storage
 * @param session The session to persist, or null to clear
 */
export async function persistSession(session: ActiveSession | null): Promise<void> {
  try {
    if (session) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to persist session:', error);
    throw new Error('Failed to save session');
  }
}

/**
 * Restores a session from storage
 * @returns The restored session or null if none exists or it's expired
 */
export async function restoreSession(): Promise<ActiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ActiveSession;

    // Check if session has expired
    if (!isSessionValid(parsed)) {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to restore session:', error);
    // Clear corrupted session data
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

/**
 * Clears the stored session
 */
export async function clearStoredSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear session storage:', error);
  }
}