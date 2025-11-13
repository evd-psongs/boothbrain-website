import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const DEVICE_ID_STORAGE_KEY = 'boothbrain_device_id';

/**
 * Generates a unique device identifier
 * @returns A unique device ID string
 */
function generateDeviceId(): string {
  const modelName = Device.modelName ?? 'device';
  const osName = Device.osName ?? 'os';
  const timestamp = Date.now();

  return `${modelName}_${osName}_${timestamp}`.replace(/\s/g, '_');
}

/**
 * Gets or creates a persistent device ID
 * @returns The device ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID
    const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    // Generate new device ID
    const newDeviceId = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.warn('Failed to access device ID storage', error);
    // Return a fallback device ID that's still unique
    return `device_${Date.now()}`;
  }
}

/**
 * Clears the stored device ID (useful for testing or reset)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear device ID', error);
  }
}