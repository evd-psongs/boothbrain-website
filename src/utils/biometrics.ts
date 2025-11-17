import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

/**
 * Check if device has biometric hardware and if user has enrolled biometrics
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    console.warn('Failed to check biometric availability:', error);
    return false;
  }
}

/**
 * Get the type of biometric authentication available on device
 */
export async function getBiometricType(): Promise<BiometricType> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'facial';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'iris';
    }

    return 'none';
  } catch (error) {
    console.warn('Failed to get biometric type:', error);
    return 'none';
  }
}

/**
 * Get user-friendly biometric prompt message based on device type
 */
export async function getBiometricPromptMessage(): Promise<string> {
  const type = await getBiometricType();

  if (Platform.OS === 'ios') {
    return type === 'facial'
      ? 'Authenticate with Face ID to continue'
      : 'Authenticate with Touch ID to continue';
  }

  // Android
  return 'Authenticate to continue';
}

/**
 * Prompt user for biometric authentication
 * @param reason Optional custom reason for authentication
 * @returns True if authentication succeeded, false otherwise
 */
export async function authenticateWithBiometrics(
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const available = await isBiometricAvailable();

    if (!available) {
      return {
        success: false,
        error: 'Biometric authentication is not available on this device'
      };
    }

    const promptMessage = reason ?? await getBiometricPromptMessage();

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false, // Allow passcode fallback
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      return { success: true };
    }

    // Handle different error cases
    if (result.error === 'user_cancel') {
      return { success: false, error: 'Authentication cancelled' };
    }

    if (result.error === 'lockout') {
      return { success: false, error: 'Too many failed attempts. Please try again later.' };
    }

    if (result.error === 'system_cancel') {
      return { success: false, error: 'Authentication was cancelled by the system' };
    }

    return { success: false, error: 'Authentication failed' };
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return {
      success: false,
      error: 'Failed to authenticate. Please try again.'
    };
  }
}

/**
 * Check if biometrics should be used for this session
 * Checks both device capability and user preference
 */
export async function shouldUseBiometrics(): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  // Check user preference
  const { getBiometricPreference } = await import('./biometricPreferences');
  const enabled = await getBiometricPreference();
  return enabled;
}
