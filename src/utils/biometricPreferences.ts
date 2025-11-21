import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_PREFERENCE_KEY = '@booth_brain_biometric_enabled';

/**
 * Get the user's biometric authentication preference
 * @returns true if biometrics are enabled (default), false otherwise
 */
export async function getBiometricPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY);
    // Default to false (disabled) if no preference is set - explicit opt-in required
    if (value === null) return false;
    return value === 'true';
  } catch (error) {
    console.warn('Failed to get biometric preference:', error);
    return false; // Default to disabled on error
  }
}

/**
 * Set the user's biometric authentication preference
 * @param enabled Whether biometrics should be enabled
 */
export async function setBiometricPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save biometric preference:', error);
    throw error;
  }
}
