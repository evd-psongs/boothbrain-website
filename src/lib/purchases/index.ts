/**
 * Purchases Module
 * Centralized exports for RevenueCat and subscription sync services
 */

// RevenueCat SDK wrapper
export {
  initializeRevenueCat,
  isRevenueCatInitialized,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  hasProEntitlement,
  logoutRevenueCat,
  addCustomerInfoUpdateListener,
} from './revenuecatService';

// Subscription sync to Supabase
export {
  syncSubscriptionToSupabase,
  hasAppleSubscription,
} from './subscriptionSync';

// Subscription status mapper
export { mapSubscriptionStatus } from './subscriptionStatusMapper';

// Plan cache
export { getProPlanId, clearPlanCache } from './planCache';
