/**
 * RevenueCat Service
 * Wrapper around react-native-purchases SDK for Apple In-App Purchase
 *
 * Purpose:
 * - Initialize RevenueCat SDK with user ID
 * - Fetch available subscription offerings
 * - Process purchases
 * - Restore purchases
 * - Manage customer info
 */

import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY_IOS = process.env.REVENUECAT_PUBLIC_API_KEY_IOS || '';

/**
 * Initialize RevenueCat SDK
 * Call this once during app startup (in SupabaseAuthProvider)
 *
 * @param userId - Supabase user ID to link with RevenueCat
 */
export async function initializeRevenueCat(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('[RevenueCat] Skipping initialization (not iOS)');
    return;
  }

  if (!REVENUECAT_API_KEY_IOS) {
    console.warn('[RevenueCat] Missing API key, skipping initialization');
    return;
  }

  try {
    // Configure SDK
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY_IOS,
      appUserID: userId, // Link RevenueCat user to Supabase user
    });

    console.log('[RevenueCat] Initialized successfully for user:', userId);
  } catch (error) {
    console.error('[RevenueCat] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get available subscription offerings
 *
 * @returns Current offering with available packages (monthly, quarterly, yearly)
 * @throws Error if offerings cannot be fetched
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current !== null) {
      console.log('[RevenueCat] Fetched current offering:', offerings.current.identifier);
      return offerings.current;
    }

    console.warn('[RevenueCat] No current offering available');
    return null;
  } catch (error) {
    console.error('[RevenueCat] Failed to get offerings:', error);
    throw error;
  }
}

/**
 * Purchase a subscription package
 *
 * @param packageToPurchase - The subscription package to purchase
 * @returns Customer info after successful purchase
 * @throws Error with message 'Purchase cancelled' if user cancels
 * @throws Error for other purchase failures
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage
): Promise<CustomerInfo> {
  try {
    console.log('[RevenueCat] Starting purchase:', packageToPurchase.identifier);

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    console.log('[RevenueCat] Purchase successful');
    return customerInfo;
  } catch (error: any) {
    // Handle user cancellation gracefully
    if (error.userCancelled) {
      console.log('[RevenueCat] Purchase cancelled by user');
      throw new Error('Purchase cancelled');
    }

    console.error('[RevenueCat] Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore previous purchases
 * Useful when user reinstalls app or logs in on new device
 *
 * @returns Customer info with restored subscriptions
 * @throws Error if restore fails
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    console.log('[RevenueCat] Starting restore purchases');

    const customerInfo = await Purchases.restorePurchases();

    console.log('[RevenueCat] Restore successful');
    return customerInfo;
  } catch (error) {
    console.error('[RevenueCat] Restore failed:', error);
    throw error;
  }
}

/**
 * Get current customer info (subscription status)
 *
 * @returns Current customer info including active entitlements
 * @throws Error if fetch fails
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('[RevenueCat] Failed to get customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active "pro" entitlement
 *
 * @param customerInfo - RevenueCat customer info
 * @returns True if user has active Pro subscription
 */
export function hasProEntitlement(customerInfo: CustomerInfo): boolean {
  const proEntitlement = customerInfo.entitlements.active['pro'];
  return proEntitlement !== undefined && proEntitlement.isActive === true;
}

/**
 * Logout current user (clear RevenueCat identity)
 * Call this during sign out
 */
export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
    console.log('[RevenueCat] User logged out');
  } catch (error) {
    console.error('[RevenueCat] Logout failed:', error);
    // Don't throw - logout should be best effort
  }
}

/**
 * Add listener for customer info updates
 * Called when subscription status changes (purchase, renewal, expiration)
 *
 * @param callback - Function to call when customer info updates
 * @returns Cleanup function to remove the listener
 */
export function addCustomerInfoUpdateListener(
  callback: (customerInfo: CustomerInfo) => void
): () => void {
  console.log('[RevenueCat] Adding customer info update listener');
  Purchases.addCustomerInfoUpdateListener(callback);

  // Return cleanup function
  return () => {
    console.log('[RevenueCat] Removing customer info update listener');
    Purchases.removeCustomerInfoUpdateListener(callback);
  };
}
