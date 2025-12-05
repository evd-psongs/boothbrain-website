# Apple In-App Purchase (IAP) Implementation Plan

**Project:** BoothBrain Pro Subscription Migration
**Date Created:** 2025-12-03
**Status:** Ready for Implementation
**Reason:** App Store requires Apple IAP for subscriptions (will reject Stripe-only implementation)

---

## Quick Reference

### Key Decisions Made ✅
- ✅ **Using RevenueCat SDK** (not direct implementation)
- ✅ **iOS-first rollout** (Android Phase 2 in 1-2 months)
- ✅ **Keep Stripe code** (don't delete, just disable on mobile)
- ✅ **Platform detection implemented** (Android shows "Coming Soon")
- ✅ **Sandbox testing fully documented** (all test cases, 2-3 hours, $0 cost)

### Implementation Summary
- **Timeline:** 1-2 weeks
- **Cost:** $0 (RevenueCat free tier, Apple Developer account already paid)
- **Complexity:** Medium (RevenueCat simplifies it significantly)
- **Testing:** Free sandbox testing, then TestFlight
- **Subscription:** $27/quarter (same as current Stripe)

### What's Already Done ✅
- ✅ Platform detection utilities (`src/utils/platform.ts`)
- ✅ Settings screen updated with Android "Coming Soon" card
- ✅ Comprehensive implementation plan (this document)
- ✅ Android strategy documented (`ANDROID_PAYMENT_STRATEGY.md`)

### Next Action
**Start Phase 1:** Set up App Store Connect subscriptions and RevenueCat account (1-2 hours)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Implementation Strategy](#implementation-strategy)
4. [Detailed Implementation Steps](#detailed-implementation-steps)
5. [Testing Plan](#testing-plan)
6. [Rollback Strategy](#rollback-strategy)
7. [Timeline & Checklist](#timeline--checklist)

---

## Executive Summary

### Why We Need This
Apple App Store Review Guidelines (3.1.1) **require** apps to use Apple's In-App Purchase system for:
- ✅ Digital subscriptions (like BoothBrain Pro)
- ✅ Premium features unlocked in-app
- ✅ Virtual currency or content consumed in the app

**Current Issue:** BoothBrain uses Stripe for Pro subscriptions, which violates these guidelines and will result in App Store rejection.

### Solution
Implement Apple IAP for iOS using **RevenueCat** SDK while maintaining the existing subscription logic and database structure.

### Key Benefits
- ✅ App Store compliant
- ✅ Built-in subscription pause/cancel (iOS Settings)
- ✅ Automatic billing management
- ✅ Familiar user experience for iOS users
- ✅ Minimal changes to existing codebase

### Trade-offs
- ❌ Apple takes 30% cut (15% after first year)
- ⚠️ Additional complexity (two payment systems to maintain)
- ⚠️ Server-side receipt validation required
- ⏱️ 1-2 weeks implementation + testing time

---

## Current Architecture

### 1. Database Schema

**Subscriptions Table** (`subscriptions`)
```sql
- id (UUID)
- user_id (UUID) → profiles.id
- plan_id (UUID) → subscription_plans.id
- status (TEXT: 'trialing', 'active', 'past_due', 'canceled', etc.)
- current_period_start (TIMESTAMP)
- current_period_end (TIMESTAMP)
- canceled_at (TIMESTAMP)
- trial_ends_at (TIMESTAMP)
- paused_at (TIMESTAMP)
- pause_used_period_start (TIMESTAMP)
- pause_allowance_used (BOOLEAN)
- stripe_subscription_id (TEXT)
- stripe_customer_id (TEXT)
- cancel_at_period_end (BOOLEAN)
```

**Subscription Plans Table** (`subscription_plans`)
```sql
- id (UUID)
- name (TEXT)
- tier (ENUM: 'free', 'pro', 'enterprise')
- max_inventory_items (INTEGER)
- currency (TEXT)
- price_cents (INTEGER)
- billing_interval_months (INTEGER)
- stripe_price_id (TEXT)
- stripe_price_id_yearly (TEXT)
```

### 2. Subscription Service Layer

**File:** `src/lib/auth/subscriptionService.ts`
```typescript
// Functions:
- fetchSubscription(userId: string): Promise<Subscription | null>
- isSubscriptionActive(subscription: Subscription | null): boolean
- getEffectivePlanTier(subscription: Subscription | null): string
```

**Key Logic:**
- Active statuses: `['trialing', 'active', 'past_due']`
- Paused subscriptions = not active
- Tier defaults to 'free' if no active subscription

### 3. Pro Feature Checks

**Files Using Pro Checks:**
- `src/hooks/useSessionOperations.ts:47-48` - Session approval features
- `src/providers/SessionProvider.tsx:66-67` - Host plan tier checks
- `src/hooks/useCrashlyticsUser.ts:28-29` - Analytics tier tracking
- `app/(tabs)/settings.tsx` - Subscription display
- `app/(tabs)/inventory.tsx` - Import features
- `app/(tabs)/sale.tsx` - Checkout features

**Check Pattern:**
```typescript
const isPro = user.subscription?.plan?.tier === 'pro';
const isPaused = Boolean(user.subscription?.pausedAt);
```

### 4. Stripe Integration Points

**Supabase Edge Functions:**
- `stripe-webhook` - Handles Stripe events (subscription.created, subscription.updated, etc.)
- `stripe-create-checkout` - Creates Stripe checkout sessions
- `stripe-billing-portal` - Opens Stripe customer portal
- `stripe-manage-pause` - Pauses/resumes Stripe subscriptions

**Client Files:**
- `src/lib/subscriptions.ts` - Pause/resume functions
- `src/components/settings/PaymentSettingsSection.tsx` - Payment links (Venmo, CashApp, PayPal)

**Current Flow:**
1. User taps "Subscribe to Pro" → Opens Stripe checkout (web)
2. Stripe webhook fires → `stripe-webhook` edge function updates Supabase
3. App polls/refreshes → `SupabaseAuthProvider` fetches updated subscription
4. Pro features unlock based on `user.subscription.plan.tier === 'pro'`

### 5. Auth Provider Integration

**File:** `src/providers/SupabaseAuthProvider.tsx`
```typescript
// Subscription loaded in buildAuthUser():
const subscription = await fetchSubscription(userId);

// Available in context:
const { user } = useAuth(); // user.subscription
```

---

## Implementation Strategy

### Recommended Approach: RevenueCat SDK

**Why RevenueCat?**
1. **Multi-platform support** - Apple IAP + Google Play + Stripe web (future)
2. **Server-side receipt validation** - Built-in, secure, no custom code needed
3. **Webhook integration** - Can update Supabase directly
4. **Free tier** - Up to $2,500/month tracked revenue (plenty for initial launch)
5. **Battle-tested** - Used by thousands of apps, handles edge cases
6. **Great docs** - React Native SDK with TypeScript support

**Alternative: Direct Implementation**
- Use `expo-in-app-purchases` (official Expo package)
- Build custom receipt validation (Supabase Edge Function)
- More control, but significantly more code to maintain
- **Not recommended** due to complexity and security concerns

---

## Detailed Implementation Steps

### Phase 1: Setup & Configuration (1-2 hours)

#### 1.1 App Store Connect Setup
**What to do:**
1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to: **Your App → Features → In-App Purchases**
3. Create a **Subscription Group**: "BoothBrain Pro"
4. Create subscription products:

**Product 1: Pro Monthly**
- Product ID: `boothbrain_pro_monthly`
- Reference Name: "BoothBrain Pro - Monthly"
- Duration: 1 Month
- Price: $9.00 (or your desired price)
- Subscription Group: BoothBrain Pro

**Product 2: Pro Quarterly** (current Stripe plan)
- Product ID: `boothbrain_pro_quarterly`
- Reference Name: "BoothBrain Pro - Quarterly"
- Duration: 3 Months
- Price: $27.00 ($2,700 cents from your current Stripe setup)
- Subscription Group: BoothBrain Pro

**Product 3: Pro Yearly** (optional)
- Product ID: `boothbrain_pro_yearly`
- Reference Name: "BoothBrain Pro - Yearly"
- Duration: 1 Year
- Price: $90.00 (save 17% vs monthly)
- Subscription Group: BoothBrain Pro

5. Fill out required metadata (description, privacy policy URL)
6. **Important:** Submit for review once configured

#### 1.2 RevenueCat Setup
**What to do:**
1. Sign up at [RevenueCat](https://www.revenuecat.com)
2. Create a new project: "BoothBrain"
3. Add iOS app:
   - Bundle ID: `com.yourcompany.boothbrainapp` (from app.config.ts)
   - Shared Secret: Get from App Store Connect → Users and Access → Shared Secret
4. Configure products in RevenueCat:
   - Create Entitlement: "pro"
   - Attach products: `boothbrain_pro_monthly`, `boothbrain_pro_quarterly`, `boothbrain_pro_yearly`
5. Get API keys:
   - **Public API Key** (iOS) - For React Native SDK
   - **Secret API Key** - For server-side validation

#### 1.3 Database Schema Updates
**What to do:**
Create migration file: `supabase/migrations/add_apple_iap_fields.sql`

```sql
-- Add Apple IAP fields to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_product_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_platform TEXT DEFAULT 'stripe' CHECK (payment_platform IN ('stripe', 'apple', 'google'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_apple_transaction
  ON subscriptions(apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.payment_platform IS 'Payment provider: stripe (web), apple (iOS IAP), google (Android IAP)';
COMMENT ON COLUMN subscriptions.apple_original_transaction_id IS 'Apple originalTransactionId - unique identifier for the subscription lifecycle';
COMMENT ON COLUMN subscriptions.apple_product_id IS 'Apple product ID purchased (e.g., boothbrain_pro_quarterly)';
```

**Run migration:**
```bash
# From Supabase dashboard SQL editor or CLI
supabase migration up
```

---

### Phase 2: Package Installation & Setup (30 minutes)

#### 2.1 Install Dependencies
```bash
# Install RevenueCat SDK
npm install react-native-purchases

# Update iOS pods (required for native modules)
npx pod-install
```

#### 2.2 Update app.config.ts
**File:** `app.config.ts`

Add RevenueCat plugin:
```typescript
export default {
  // ... existing config
  plugins: [
    // ... existing plugins
    [
      "react-native-purchases",
      {
        "apiKey": process.env.REVENUECAT_PUBLIC_API_KEY_IOS // Will add to .env
      }
    ]
  ]
}
```

#### 2.3 Update Environment Variables
**File:** `.env` (create if doesn't exist, add to .gitignore)
```bash
# RevenueCat API Keys
REVENUECAT_PUBLIC_API_KEY_IOS=your_ios_public_key_here
REVENUECAT_SECRET_API_KEY=your_secret_key_here

# Supabase (existing)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**File:** `.env.example` (update for documentation)
```bash
# Add these lines:
REVENUECAT_PUBLIC_API_KEY_IOS=rcpub_ios_xxxxxxxxxxxxxx
REVENUECAT_SECRET_API_KEY=sk_xxxxxxxxxxxxxx
```

---

### Phase 3: RevenueCat Service Layer (2-3 hours)

#### 3.1 Create RevenueCat Service
**File:** `src/lib/purchases/revenuecatService.ts` (new file)

```typescript
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
 */
export async function initializeRevenueCat(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    console.log('RevenueCat: Skipping initialization (not iOS)');
    return;
  }

  if (!REVENUECAT_API_KEY_IOS) {
    console.warn('RevenueCat: Missing API key, skipping initialization');
    return;
  }

  try {
    // Configure SDK
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY_IOS,
      appUserID: userId, // Link RevenueCat user to Supabase user
    });

    console.log('RevenueCat: Initialized successfully for user', userId);
  } catch (error) {
    console.error('RevenueCat: Initialization failed', error);
    throw error;
  }
}

/**
 * Get available subscription offerings
 * @returns List of subscription packages (monthly, quarterly, yearly)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current !== null) {
      return offerings.current;
    }

    console.warn('RevenueCat: No current offering available');
    return null;
  } catch (error) {
    console.error('RevenueCat: Failed to get offerings', error);
    throw error;
  }
}

/**
 * Purchase a subscription package
 * @param packageToPurchase The subscription package to purchase
 * @returns Customer info after purchase
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage
): Promise<CustomerInfo> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error: any) {
    // Handle user cancellation gracefully
    if (error.userCancelled) {
      throw new Error('Purchase cancelled');
    }

    console.error('RevenueCat: Purchase failed', error);
    throw error;
  }
}

/**
 * Restore previous purchases
 * Useful when user reinstalls app or logs in on new device
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Restore failed', error);
    throw error;
  }
}

/**
 * Get current customer info (subscription status)
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Failed to get customer info', error);
    throw error;
  }
}

/**
 * Check if user has active "pro" entitlement
 * @param customerInfo RevenueCat customer info
 * @returns True if user has active Pro subscription
 */
export function hasProEntitlement(customerInfo: CustomerInfo): boolean {
  return (
    customerInfo.entitlements.active['pro'] !== undefined &&
    customerInfo.entitlements.active['pro']?.isActive === true
  );
}

/**
 * Logout current user (clear RevenueCat identity)
 * Call this during sign out
 */
export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
    console.log('RevenueCat: User logged out');
  } catch (error) {
    console.error('RevenueCat: Logout failed', error);
  }
}
```

#### 3.2 Create Subscription Sync Service
**File:** `src/lib/purchases/subscriptionSync.ts` (new file)

```typescript
import { CustomerInfo } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';

/**
 * Sync RevenueCat subscription to Supabase
 * Called after successful purchase or when app starts
 */
export async function syncSubscriptionToSupabase(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  try {
    const proEntitlement = customerInfo.entitlements.active['pro'];

    if (!proEntitlement) {
      console.log('Subscription sync: No active Pro entitlement');
      return;
    }

    // Extract subscription details
    const originalTransactionId = proEntitlement.originalTransactionId;
    const productId = proEntitlement.productIdentifier;
    const periodType = proEntitlement.periodType; // 'normal', 'trial', 'intro'
    const expirationDate = proEntitlement.expirationDate;
    const willRenew = proEntitlement.willRenew;
    const unsubscribeDetectedAt = proEntitlement.unsubscribeDetectedAt;

    // Determine status
    let status: string;
    if (periodType === 'trial') {
      status = 'trialing';
    } else if (willRenew) {
      status = 'active';
    } else if (unsubscribeDetectedAt) {
      status = 'canceled';
    } else {
      status = 'active';
    }

    // Find or create subscription plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'pro')
      .single();

    if (planError || !plan) {
      console.error('Subscription sync: Failed to find Pro plan', planError);
      return;
    }

    // Check if subscription already exists
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('apple_original_transaction_id', originalTransactionId)
      .maybeSingle();

    const subscriptionData = {
      user_id: userId,
      plan_id: plan.id,
      status,
      payment_platform: 'apple',
      apple_original_transaction_id: originalTransactionId,
      apple_product_id: productId,
      current_period_end: expirationDate,
      canceled_at: unsubscribeDetectedAt || null,
      trial_ends_at: periodType === 'trial' ? expirationDate : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('Subscription sync: Update failed', updateError);
        throw updateError;
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Subscription sync: Insert failed', insertError);
        throw insertError;
      }
    }

    console.log('Subscription sync: Successfully synced to Supabase');
  } catch (error) {
    console.error('Subscription sync: Failed', error);
    throw error;
  }
}
```

---

### Phase 4: UI Components (2-3 hours)

#### 4.1 Create Subscription Modal
**File:** `src/components/modals/SubscriptionModal.tsx` (new file)

```typescript
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/purchases/revenuecatService';
import { syncSubscriptionToSupabase } from '@/lib/purchases/subscriptionSync';
import { PrimaryButton, SecondaryButton } from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  theme: Theme;
}

export function SubscriptionModal({ visible, onClose, onSuccess, userId, theme }: SubscriptionModalProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && Platform.OS === 'ios') {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setLoading(true);
    setError(null);
    try {
      const offering = await getOfferings();
      if (offering && offering.availablePackages) {
        setPackages(offering.availablePackages);
      } else {
        setError('No subscription plans available');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    setError(null);
    try {
      const customerInfo = await purchasePackage(pkg);

      // Sync to Supabase
      await syncSubscriptionToSupabase(userId, customerInfo);

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.message === 'Purchase cancelled') {
        // User cancelled, don't show error
        return;
      }
      setError(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const customerInfo = await restorePurchases();

      // Sync to Supabase
      await syncSubscriptionToSupabase(userId, customerInfo);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const getPackageTitle = (pkg: PurchasesPackage): string => {
    if (pkg.identifier.includes('monthly')) return 'Monthly';
    if (pkg.identifier.includes('quarterly')) return 'Quarterly';
    if (pkg.identifier.includes('yearly')) return 'Yearly';
    return pkg.identifier;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Upgrade to Pro
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading plans...
              </Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorBackground }]}>
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={styles.packagesContainer}>
                {packages.map((pkg) => (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => handlePurchase(pkg)}
                    disabled={purchasing || restoring}
                    style={({ pressed }) => [
                      styles.packageCard,
                      {
                        backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.surface,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    <View style={styles.packageInfo}>
                      <Text style={[styles.packageTitle, { color: theme.colors.textPrimary }]}>
                        {getPackageTitle(pkg)}
                      </Text>
                      <Text style={[styles.packagePrice, { color: theme.colors.primary }]}>
                        {formatPrice(pkg)}
                      </Text>
                    </View>
                    {purchasing ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </View>

              <SecondaryButton
                title="Restore Purchases"
                onPress={handleRestore}
                disabled={purchasing || restoring}
                loading={restoring}
                backgroundColor={theme.colors.surface}
                borderColor={theme.colors.border}
                textColor={theme.colors.textPrimary}
              />

              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  packagesContainer: {
    marginBottom: 20,
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
  },
});
```

#### 4.2 Update Settings Screen
**File:** `app/(tabs)/settings.tsx`

Add subscription management section:
```typescript
// Add import
import { SubscriptionModal } from '@/components/modals/SubscriptionModal';
import { Platform } from 'react-native';

// Inside component:
const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

// In the JSX, add after PaymentSettingsSection:
{Platform.OS === 'ios' && (
  <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
    <SectionHeading
      title="Subscription"
      subtitle={isPro ? "You're subscribed to Pro" : "Unlock Pro features"}
      titleColor={theme.colors.textPrimary}
      subtitleColor={theme.colors.textSecondary}
    />

    <PrimaryButton
      title={isPro ? "Manage Subscription" : "Subscribe to Pro"}
      onPress={() => setShowSubscriptionModal(true)}
      backgroundColor={theme.colors.primaryDark}
      textColor={theme.colors.surface}
    />
  </View>
)}

{/* Add modal at bottom */}
<SubscriptionModal
  visible={showSubscriptionModal}
  onClose={() => setShowSubscriptionModal(false)}
  onSuccess={() => {
    // Refresh user data
    // This will be handled by RevenueCat listener in Phase 5
  }}
  userId={user?.id || ''}
  theme={theme}
/>
```

---

### Phase 5: Integration with Auth Provider (1-2 hours)

#### 5.1 Initialize RevenueCat on Login
**File:** `src/providers/SupabaseAuthProvider.tsx`

```typescript
// Add imports
import { initializeRevenueCat, logoutRevenueCat } from '@/lib/purchases/revenuecatService';
import { syncSubscriptionToSupabase } from '@/lib/purchases/subscriptionSync';
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// In the useEffect that handles auth state changes, add:
useEffect(() => {
  // ... existing subscription code

  const listener = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      setSession(session);

      // Initialize RevenueCat for iOS users
      if (Platform.OS === 'ios') {
        try {
          await initializeRevenueCat(session.user.id);

          // Setup listener for purchase updates
          Purchases.addCustomerInfoUpdateListener(async (customerInfo) => {
            console.log('RevenueCat: Customer info updated');
            await syncSubscriptionToSupabase(session.user.id, customerInfo);

            // Refresh user data
            const authUser = await buildAuthUser(session.user);
            setUser(authUser);
          });

          // Sync existing subscription if any
          const customerInfo = await Purchases.getCustomerInfo();
          await syncSubscriptionToSupabase(session.user.id, customerInfo);
        } catch (error) {
          console.error('RevenueCat: Setup failed', error);
        }
      }

      // Build and set user
      const authUser = await buildAuthUser(session.user);
      setUser(authUser);
    } else if (event === 'SIGNED_OUT') {
      // Logout RevenueCat
      if (Platform.OS === 'ios') {
        await logoutRevenueCat();
      }

      setSession(null);
      setUser(null);
    }
  });

  return () => {
    listener.data.subscription.unsubscribe();
  };
}, []);
```

#### 5.2 Update Subscription Service
**File:** `src/lib/auth/subscriptionService.ts`

Update to handle Apple subscriptions:
```typescript
// Modify isSubscriptionActive to check payment_platform
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  // Check for pause
  if (subscription.pausedAt) return false;

  // Apple IAP subscriptions - check expiration date
  if (subscription.paymentPlatform === 'apple') {
    const now = new Date();
    const expiresAt = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    // Active if current period hasn't expired yet
    return expiresAt ? expiresAt > now : false;
  }

  // Stripe subscriptions - use status field
  const activeStatuses = ['trialing', 'active', 'past_due'];
  return activeStatuses.includes(subscription.status || '');
}
```

Add to database.ts types:
```typescript
export type SubscriptionRow = {
  // ... existing fields
  apple_original_transaction_id?: string | null;
  apple_product_id?: string | null;
  payment_platform?: 'stripe' | 'apple' | 'google';
};
```

---

### Phase 6: Server-Side Webhook (2-3 hours)

#### 6.1 Create RevenueCat Webhook Handler
**File:** `supabase/functions/revenuecat-webhook/index.ts` (new file)

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Verify webhook signature (optional but recommended)
  const signature = req.headers.get('X-RevenueCat-Signature');
  // TODO: Implement signature verification with REVENUECAT_WEBHOOK_SECRET

  try {
    const payload = await req.json();
    const event = payload.event;

    console.log('RevenueCat webhook:', event.type);

    // Extract data
    const appUserId = event.app_user_id; // This is your Supabase user ID
    const productId = event.product_id;
    const originalTransactionId = event.original_transaction_id;
    const expirationDate = event.expiration_at_ms
      ? new Date(parseInt(event.expiration_at_ms)).toISOString()
      : null;
    const isTrial = event.is_trial_period === 'true';
    const willRenew = event.auto_renew_status === 'true';

    // Determine status
    let status: string;
    if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
      status = isTrial ? 'trialing' : 'active';
    } else if (event.type === 'CANCELLATION') {
      status = 'canceled';
    } else if (event.type === 'EXPIRATION') {
      status = 'canceled';
    } else {
      status = 'active'; // Default
    }

    // Get Pro plan ID
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'pro')
      .single();

    if (planError || !plan) {
      console.error('Failed to find Pro plan:', planError);
      return json({ error: 'Plan not found' }, 500);
    }

    // Check if subscription exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', appUserId)
      .eq('apple_original_transaction_id', originalTransactionId)
      .maybeSingle();

    const subscriptionData = {
      user_id: appUserId,
      plan_id: plan.id,
      status,
      payment_platform: 'apple',
      apple_original_transaction_id: originalTransactionId,
      apple_product_id: productId,
      current_period_end: expirationDate,
      canceled_at: event.type === 'CANCELLATION' ? new Date().toISOString() : null,
      trial_ends_at: isTrial ? expirationDate : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSub) {
      // Update
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSub.id);

      if (updateError) {
        console.error('Failed to update subscription:', updateError);
        return json({ error: 'Update failed' }, 500);
      }
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert subscription:', insertError);
        return json({ error: 'Insert failed' }, 500);
      }
    }

    console.log('RevenueCat webhook: Successfully processed');
    return json({ received: true });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
```

#### 6.2 Deploy Webhook
```bash
# Deploy edge function
supabase functions deploy revenuecat-webhook

# Set webhook URL in RevenueCat dashboard:
# https://your-project.supabase.co/functions/v1/revenuecat-webhook
```

#### 6.3 Configure RevenueCat Webhook
1. Go to RevenueCat dashboard → Project Settings → Webhooks
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
3. Select events to send:
   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `CANCELLATION`
   - `EXPIRATION`
   - `BILLING_ISSUE`
4. Save and test

---

### Phase 7: Platform Detection & Graceful Degradation (1 hour)

#### 7.1 Create Platform Utilities
**File:** `src/utils/platform.ts` (new file)

```typescript
import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Check if Apple IAP is available
 */
export function isAppleIAPAvailable(): boolean {
  return isIOS;
}

/**
 * Check if Stripe checkout is available
 * (web or platforms without native IAP)
 */
export function isStripeAvailable(): boolean {
  // For now, disable Stripe on iOS to force Apple IAP
  // Later, you can enable Stripe for web/Android
  return !isIOS;
}

/**
 * Get subscription provider name for current platform
 */
export function getSubscriptionProvider(): 'apple' | 'stripe' | 'none' {
  if (isIOS) return 'apple';
  // Future: Add Google Play for Android
  // if (isAndroid) return 'google';
  return 'stripe'; // Web fallback
}
```

#### 7.2 Update Settings to Show Correct UI
**File:** `app/(tabs)/settings.tsx`

```typescript
import { isAppleIAPAvailable, isStripeAvailable } from '@/utils/platform';

// Conditional rendering:
{isAppleIAPAvailable() && (
  <SubscriptionModal ... />
)}

{isStripeAvailable() && (
  <PrimaryButton
    title="Subscribe via Stripe"
    onPress={handleStripeCheckout}
    ...
  />
)}
```

---

## Testing Plan

### ⚠️ IMPORTANT: Expo Go Not Supported

**Apple IAP will NOT work in Expo Go!**

RevenueCat requires native modules that aren't included in Expo Go. When running in Expo Go, you'll see:

```
[RevenueCat] Missing API key, skipping initialization
[Auth] RevenueCat setup failed: There is no singleton instance
```

**These errors are expected and safe** - they won't crash your app. The code is designed to handle this gracefully.

**What Works in Expo Go:**
- ✅ UI/UX testing (Settings screen, modal layout, buttons)
- ✅ Platform detection (iOS shows "View Plans", Android shows "Coming Soon")
- ✅ All non-IAP features

**What Doesn't Work in Expo Go:**
- ❌ RevenueCat initialization
- ❌ Fetching subscription offerings
- ❌ Making purchases
- ❌ Restore purchases
- ❌ All IAP functionality

**For IAP Testing, Use:**
1. **EAS Build + TestFlight** (Recommended, no Mac needed)
   ```bash
   npm run ship:ios
   npm run submit:ios
   ```

2. **Development Build** (Requires Mac with Xcode)
   ```bash
   npx expo run:ios --device
   ```

3. **EAS Preview Build** (Quick testing, no Mac needed)
   ```bash
   eas build --profile preview --platform ios
   ```

---

### Understanding Apple Sandbox Testing

**What is Sandbox?**
Apple provides a completely FREE testing environment where you can test purchases without spending real money.

**Sandbox Benefits:**
- ✅ Unlimited free test purchases
- ✅ Fast subscription renewals (minutes instead of months)
- ✅ Test full purchase lifecycle
- ✅ Test cancellations, refunds, renewals
- ✅ No risk to real payment methods

**Sandbox Subscription Renewal Times:**

| Real Duration | Sandbox Renewal Time |
|---------------|---------------------|
| 3 days | 2 minutes |
| 1 week | 3 minutes |
| 1 month | 5 minutes |
| 2 months | 10 minutes |
| **3 months (Quarterly)** | **15 minutes** |
| 6 months | 30 minutes |
| 1 year | 1 hour |

**For BoothBrain Pro ($27/quarter):**
- Sandbox renews every **15 minutes**
- Max 6 renewals, then auto-cancels (tests expiration)
- Can test full subscription lifecycle in 90 minutes

---

### Pre-TestFlight Testing (Sandbox)

#### 1. Create Sandbox Test Accounts

**Step-by-Step:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to: **Users and Access** → **Sandbox** → **Testers**
3. Click **+** (Add button) to create a new sandbox tester
4. Fill out test user details:
   - **Email:** `test1@boothbrain.com` (doesn't need to be real!)
   - **Password:** Create a strong password (save it!)
   - **First Name:** Test
   - **Last Name:** User
   - **Country:** United States
   - **App Store Territory:** United States
5. Click **Invite**

**Create Multiple Test Accounts:**
Recommended accounts for different test scenarios:
- `test-monthly@boothbrain.com` - For testing monthly plan
- `test-quarterly@boothbrain.com` - For testing quarterly plan (your main plan)
- `test-yearly@boothbrain.com` - For testing yearly plan (if you add it)
- `test-cancelled@boothbrain.com` - For testing cancellation flow

**Important Notes:**
- ⚠️ **Use FAKE emails** - Apple doesn't verify sandbox emails
- ⚠️ **NEVER use your real Apple ID** for sandbox testing
- ⚠️ **Save passwords** - You'll need them for each test
- ✅ These accounts only work in sandbox (not production)

---

#### 2. Prepare Your Device for Sandbox Testing

**On Your Physical iOS Device:**

**Step 1: Sign Out of Real App Store Account**
1. Open **Settings** on iPhone/iPad
2. Tap **App Store** at the top
3. Tap your Apple ID name/email
4. Scroll down and tap **Sign Out**
5. Confirm sign out

**Step 2: DO NOT Sign Into Sandbox Account Yet**
- ⚠️ **Important:** Do NOT sign into sandbox account in Settings
- ❌ Don't go to Settings → App Store → Sign In (this is for real accounts)
- ✅ You'll sign in with sandbox account when you try to purchase (app prompts you)

**Why?**
- Sandbox accounts only work when triggered by in-app purchase
- Signing in via Settings won't work and causes confusion

**Device Requirements:**
- ✅ Physical iPhone or iPad (sandbox doesn't work in simulator)
- ✅ iOS 15.1+ (per your deployment target)
- ✅ Installed via TestFlight, EAS build, or Xcode (NOT Expo Go)
- ❌ Expo Go will NOT work - see warning above

---

#### 3. Test Purchase Flow (Complete Walkthrough)

**Step-by-Step Purchase Test:**

1. **Launch Your App**
   - [ ] Open BoothBrain on physical device
   - [ ] Ensure you're signed out of real App Store account
   - [ ] Verify app is sandbox-ready build (Xcode or TestFlight)

2. **Navigate to Subscription**
   - [ ] Sign into BoothBrain with test user account
   - [ ] Go to Settings tab
   - [ ] Scroll to subscription section

3. **Initiate Purchase**
   - [ ] Tap "Subscribe to Pro"
   - [ ] Verify subscription modal appears with plans
   - [ ] Verify pricing displays correctly (from App Store Connect)
   - [ ] Select "Quarterly" plan ($27 for 3 months)

4. **Complete Sandbox Purchase**
   - [ ] iOS shows: "Sign in to iTunes Store"
   - [ ] Enter sandbox account credentials (e.g., `test-quarterly@boothbrain.com`)
   - [ ] Tap **Sign In**
   - [ ] Review subscription details
   - [ ] Confirm purchase (no real charge!)
   - [ ] Wait for "Purchase Successful" confirmation

5. **Verify Purchase Success**
   - [ ] Modal closes automatically
   - [ ] Pro features unlock immediately
   - [ ] Settings shows "Pro" subscription status
   - [ ] Check RevenueCat dashboard for purchase event
   - [ ] Check Supabase subscriptions table for new row

**Expected Supabase Record:**
```sql
SELECT
  user_id,
  status,
  payment_platform,
  apple_product_id,
  current_period_end
FROM subscriptions
WHERE payment_platform = 'apple'
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `status`: 'active'
- `payment_platform`: 'apple'
- `apple_product_id`: 'boothbrain_pro_quarterly'
- `current_period_end`: ~15 minutes from now

---

#### 4. Test Auto-Renewal (15-Minute Test)

**Test Subscription Renewal:**

1. **After Initial Purchase:**
   - [ ] Note current time
   - [ ] Keep app open or in background
   - [ ] Set timer for 16 minutes

2. **Wait 15 Minutes:**
   - [ ] Sandbox subscription renews automatically
   - [ ] No user action required

3. **Verify Renewal:**
   - [ ] Open RevenueCat dashboard
   - [ ] Check for `RENEWAL` webhook event
   - [ ] Open Supabase subscriptions table
   - [ ] Verify `current_period_end` extended by 15 minutes
   - [ ] Verify `status` still 'active'
   - [ ] Verify Pro features still unlocked

4. **Test Multiple Renewals:**
   - [ ] Wait another 15 minutes (2nd renewal)
   - [ ] Wait another 15 minutes (3rd renewal)
   - [ ] After 6 renewals (90 min), subscription auto-cancels

**Why Test This?**
- Ensures webhook integration works
- Validates subscription extension logic
- Tests RevenueCat → Supabase sync

---

#### 5. Test Restore Purchases

**Test Restore Flow:**

1. **While Subscribed:**
   - [ ] Verify Pro features are active
   - [ ] Note your subscription status

2. **Delete App:**
   - [ ] Long-press BoothBrain icon
   - [ ] Tap "Remove App" → "Delete App"
   - [ ] Confirm deletion

3. **Reinstall App:**
   - [ ] Reinstall via TestFlight or Xcode
   - [ ] Launch app
   - [ ] Sign in with same BoothBrain account

4. **Verify Subscription Lost:**
   - [ ] Pro features should be locked (subscription not restored yet)
   - [ ] Settings shows "Free" tier

5. **Restore Purchase:**
   - [ ] Tap "Restore Purchases" button
   - [ ] iOS prompts: "Sign in to iTunes Store"
   - [ ] Enter same sandbox account credentials
   - [ ] Wait for "Restore Successful" message

6. **Verify Restore Success:**
   - [ ] Pro features unlock immediately
   - [ ] Settings shows "Pro" subscription status
   - [ ] No new charge (just restored existing)

**Why Test This?**
- Critical for users who reinstall app
- Tests receipt validation
- Ensures RevenueCat recognizes existing subscription

---

#### 6. Test Subscription Cancellation

**Test Cancel Flow:**

1. **While Subscribed:**
   - [ ] Verify Pro features active
   - [ ] Note `current_period_end` from database

2. **Cancel Subscription:**
   - [ ] Open iOS **Settings**
   - [ ] Tap **[Your Name]** at top
   - [ ] Tap **Subscriptions**
   - [ ] Find "BoothBrain Pro"
   - [ ] Tap subscription
   - [ ] Tap **Cancel Subscription**
   - [ ] Confirm cancellation

3. **Immediate After Cancel:**
   - [ ] App still shows Pro features (subscription active until period ends)
   - [ ] Settings shows "Subscription will expire on [date]"
   - [ ] RevenueCat receives `CANCELLATION` webhook

4. **Wait for Expiration (15 min in sandbox):**
   - [ ] Wait until `current_period_end` passes
   - [ ] Open app (or app auto-refreshes)

5. **Verify Expiration:**
   - [ ] Pro features lock automatically
   - [ ] Settings shows "Free" tier
   - [ ] RevenueCat receives `EXPIRATION` webhook
   - [ ] Supabase status updates to 'canceled'

**Why Test This?**
- Ensures graceful downgrade
- Tests expiration detection
- Validates feature locking logic

---

#### 7. Test Edge Cases

**Test 1: User Cancels Purchase Sheet**
- [ ] Start purchase flow
- [ ] When iOS payment sheet appears, tap "Cancel"
- [ ] Verify no error message shown to user
- [ ] Verify app returns to normal state
- [ ] Verify no subscription created

**Test 2: Multiple Rapid Purchases**
- [ ] Try tapping "Subscribe" button multiple times rapidly
- [ ] Verify only one purchase processes
- [ ] Verify no duplicate subscriptions created

**Test 3: Network Interruption**
- [ ] Enable Airplane Mode
- [ ] Try to purchase
- [ ] Verify clear error message shown
- [ ] Disable Airplane Mode
- [ ] Retry purchase successfully

**Test 4: Wrong Sandbox Account**
- [ ] Try signing in with production Apple ID during purchase
- [ ] Verify clear error message
- [ ] Guide user to use sandbox account

**Test 5: Invalid Product**
- [ ] Manually trigger purchase with wrong product ID (dev test)
- [ ] Verify graceful error handling
- [ ] Verify no crash

**Test 6: Resubscribe After Cancel**
- [ ] Cancel subscription
- [ ] Wait for expiration (15 min)
- [ ] Subscribe again with same sandbox account
- [ ] Verify new subscription created
- [ ] Verify Pro features unlock

---

#### 8. Test Multiple Devices

**Test Subscription Sync:**

1. **Device A (iPhone):**
   - [ ] Purchase subscription
   - [ ] Verify Pro unlocked

2. **Device B (iPad):**
   - [ ] Sign into same sandbox Apple ID
   - [ ] Install BoothBrain
   - [ ] Sign into same BoothBrain account
   - [ ] Tap "Restore Purchases"
   - [ ] Verify Pro unlocks on Device B

3. **Verify Sync:**
   - [ ] Both devices show Pro status
   - [ ] Cancel on Device A
   - [ ] Verify Device B detects cancellation (may take a few minutes)

---

#### 9. Monitor Backend Integration

**During All Tests, Monitor:**

**RevenueCat Dashboard:**
- [ ] Go to RevenueCat → Customers
- [ ] Find your test user by Supabase user ID
- [ ] Verify events appear: INITIAL_PURCHASE, RENEWAL, CANCELLATION
- [ ] Check entitlements show "pro" active

**Supabase Database:**
```sql
-- Watch subscriptions in real-time
SELECT
  id,
  user_id,
  status,
  payment_platform,
  apple_product_id,
  current_period_end,
  created_at,
  updated_at
FROM subscriptions
WHERE payment_platform = 'apple'
ORDER BY updated_at DESC;
```

**Supabase Edge Function Logs:**
- [ ] Go to Supabase → Edge Functions → revenuecat-webhook
- [ ] Click "Logs"
- [ ] Verify webhook events arriving
- [ ] Verify no errors in processing

**App Logs (Xcode Console):**
- [ ] Watch for: "RevenueCat: Customer info updated"
- [ ] Watch for: "Subscription sync: Successfully synced to Supabase"
- [ ] Watch for: No errors or crashes

---

### Sandbox Troubleshooting

**Common Issues & Solutions:**

**Issue 1: "Cannot connect to iTunes Store"**
- ✅ **Solution:** Sign out of real App Store account first
- ✅ Don't sign into sandbox in Settings - wait for purchase prompt

**Issue 2: "This Apple ID is not valid or not supported"**
- ✅ **Solution:** Make sure you're using sandbox account, not real Apple ID
- ✅ Verify app is sandbox build (TestFlight or Xcode), not App Store build

**Issue 3: Stuck on "Verifying purchase..."**
- ✅ **Solution:** Delete app, clear Safari cache, reinstall
- ✅ Sandbox can be flaky - just retry
- ✅ Check internet connection

**Issue 4: "Subscription already active on different account"**
- ✅ **Solution:** Create new sandbox test account
- ✅ Each test account can only have one active subscription

**Issue 5: RevenueCat webhook not firing**
- ✅ **Solution:** Check webhook URL in RevenueCat dashboard
- ✅ Verify edge function deployed correctly
- ✅ Check Supabase function logs for errors

**Issue 6: Multiple sandbox sign-in prompts**
- ✅ **Normal behavior** - Sandbox is more chatty than production
- ✅ Production flow is much smoother

---

### Pre-Production Checklist

**Before Submitting to App Store, Verify:**

- [ ] **All Purchase Tests Pass**
  - [ ] Monthly plan (if offered)
  - [ ] Quarterly plan ($27/3 months)
  - [ ] Yearly plan (if offered)

- [ ] **All Management Tests Pass**
  - [ ] Auto-renewal works
  - [ ] Cancellation works
  - [ ] Restore purchases works
  - [ ] Resubscription works

- [ ] **All Edge Cases Handled**
  - [ ] User cancels purchase sheet (no error)
  - [ ] Network errors handled gracefully
  - [ ] Invalid product IDs don't crash app
  - [ ] Multiple rapid taps handled

- [ ] **Backend Integration Works**
  - [ ] RevenueCat receives all events
  - [ ] Supabase subscriptions created/updated
  - [ ] Webhooks fire successfully
  - [ ] Database fields populated correctly

- [ ] **UI/UX Polish**
  - [ ] Loading states during purchase
  - [ ] Success messages after purchase
  - [ ] Clear error messages
  - [ ] Subscription status updates in UI

- [ ] **Multi-Device Testing**
  - [ ] Tested on iPhone
  - [ ] Tested on iPad (if supporting)
  - [ ] Tested on iOS 15.1, 16, 17, 18
  - [ ] Subscription syncs across devices

- [ ] **Performance**
  - [ ] No crashes during purchase flow
  - [ ] No memory leaks
  - [ ] Smooth UI transitions
  - [ ] Fast receipt validation (< 3 seconds)

---

### Sandbox Testing Summary

**Total Testing Time:** 2-3 hours
**Cost:** $0 (completely free)
**Required:** Physical iOS device

**Testing Timeline:**
- Purchase flow: 15 minutes
- Auto-renewal test: 90 minutes (6 renewals)
- Restore test: 10 minutes
- Cancellation test: 20 minutes
- Edge cases: 30 minutes
- Multi-device: 20 minutes

**After Sandbox Testing:**
- Submit to TestFlight for beta testing
- Invite 5-10 internal testers
- Test with real Apple IDs in production mode
- Collect feedback on UX
- Then submit to App Store for review

### TestFlight Testing

#### 1. Upload Build
```bash
npm run build:prod:ios
npm run submit:ios
```

#### 2. Internal Testing
- [ ] Invite internal testers via TestFlight
- [ ] Test purchase flow with real Apple ID
- [ ] Verify subscription charges correct amount
- [ ] Test on multiple iOS versions (iOS 15, 16, 17, 18)
- [ ] Test on multiple device types (iPhone, iPad)

#### 3. External Beta Testing
- [ ] Invite 10-20 beta testers
- [ ] Collect feedback on purchase flow UX
- [ ] Monitor for crashes or errors
- [ ] Verify webhook events arrive in Supabase logs

---

## Rollback Strategy

### If Implementation Fails

**Option 1: Quick Rollback (< 1 hour)**
1. Remove SubscriptionModal from Settings screen
2. Revert to Stripe-only (keep for web/Android)
3. Add disclaimer: "iOS subscriptions coming soon"
4. Deploy update to TestFlight

**Option 2: Hybrid Approach (1-2 days)**
1. Keep Stripe for web users
2. Add Apple IAP for iOS only
3. Both systems write to same `subscriptions` table
4. Use `payment_platform` field to distinguish

**Option 3: Delay App Store Submission (1-2 weeks)**
1. Release on Google Play Store first (if Android ready)
2. Polish Apple IAP implementation
3. Resubmit to App Store when stable

### Database Rollback
If database migration fails:
```sql
-- Remove Apple IAP fields
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS apple_original_transaction_id,
  DROP COLUMN IF EXISTS apple_product_id,
  DROP COLUMN IF EXISTS payment_platform;
```

---

## Timeline & Checklist

### Phase 1: Setup (Day 1) ✅ COMPLETE
- [x] Create subscription products in App Store Connect
- [x] Sign up for RevenueCat account
- [x] Configure RevenueCat project and products
- [ ] Run database migration (Phase 2)
- [x] Set up environment variables

### Phase 2: Installation (Day 1-2) ✅
- [ ] Install `react-native-purchases` package
- [ ] Update `app.config.ts` with plugin
- [ ] Run `npx pod-install`
- [ ] Test app builds successfully

### Phase 3: Service Layer (Day 2-3) ✅
- [ ] Create `revenuecatService.ts`
- [ ] Create `subscriptionSync.ts`
- [ ] Add platform utilities
- [ ] Update type definitions

### Phase 4: UI Components (Day 3-4) ✅
- [ ] Create `SubscriptionModal.tsx`
- [ ] Update Settings screen
- [ ] Test UI on device
- [ ] Polish styling

### Phase 5: Integration (Day 4-5) ✅
- [ ] Update `SupabaseAuthProvider.tsx`
- [ ] Initialize RevenueCat on login
- [ ] Add purchase update listener
- [ ] Update subscription service logic

### Phase 6: Webhooks (Day 5-6) ✅
- [ ] Create `revenuecat-webhook` edge function
- [ ] Deploy to Supabase
- [ ] Configure webhook in RevenueCat
- [ ] Test webhook events

### Phase 7: Testing (Day 6-8) ✅
- [ ] Sandbox testing (all test cases)
- [ ] Fix any bugs found
- [ ] TestFlight internal testing
- [ ] TestFlight external beta testing

### Phase 8: Launch (Day 9-10) ✅
- [ ] Final QA pass
- [ ] Update App Store listing
- [ ] Submit for App Store review
- [ ] Monitor for issues

---

## Important: Keep Stripe Code

**Decision: DO NOT DELETE STRIPE CODE**

**Reasons to Keep Stripe:**
1. ✅ **Existing subscribers** - May have active Stripe subscriptions that need to keep working
2. ✅ **Web version (future)** - Can offer direct subscriptions via web (no 30% Apple fee)
3. ✅ **Testing** - Can test subscription logic without TestFlight
4. ✅ **Fallback** - Backup if Apple rejects app or RevenueCat has issues
5. ✅ **Low risk** - Dormant code doesn't hurt anything

**What Happens with Stripe:**
- iOS users: Platform detection hides Stripe UI, only shows Apple IAP
- Android users: Shows "Coming Soon" (Phase 1), later Google Play (Phase 2)
- Web users: Can use Stripe in future web app (optional)
- Existing Stripe subscribers: Continue working normally

**When to Consider Deleting Stripe:**
- After 6+ months of Apple IAP being stable
- After ALL Stripe subscribers migrated/expired
- After confirming you'll never build web version
- Check active Stripe subscriptions first:
  ```sql
  SELECT COUNT(*) FROM subscriptions
  WHERE stripe_subscription_id IS NOT NULL
  AND status = 'active';
  ```

**Current Approach:**
- Keep all Stripe code and edge functions
- Platform detection ensures iOS users don't see it
- Can re-enable for web later if desired
- Zero risk, maximum flexibility

---

## Next Steps

**Immediate Actions:**
1. ✅ Read this plan thoroughly
2. ✅ Decide: RevenueCat (recommended) or direct implementation
3. ✅ Create App Store Connect subscription products
4. ✅ Sign up for RevenueCat account

**Before Starting:**
- [ ] Backup production database
- [ ] Test on physical iOS device (IAP won't work in simulator)
- [ ] Have Apple Developer account in good standing
- [ ] Clear calendar for 1-2 focused days of implementation

**Questions to Answer:**
- ❓ Subscription pricing: Keep $27/quarter or add monthly/yearly?
- ❓ Free trial: Offer 7-day or 14-day trial?
- ❓ Intro pricing: Offer discounted first period?
- ❓ Family sharing: Enable for subscriptions?

---

## Resources

**Documentation:**
- RevenueCat: https://www.revenuecat.com/docs
- React Native SDK: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Apple IAP: https://developer.apple.com/in-app-purchase/
- App Store Guidelines: https://developer.apple.com/app-store/review/guidelines/#in-app-purchase

**Support:**
- RevenueCat Community: https://community.revenuecat.com
- RevenueCat Support: support@revenuecat.com (free tier has email support)
- Expo Forums: https://forums.expo.dev

**Testing:**
- Sandbox Testing Guide: https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox
- TestFlight: https://developer.apple.com/testflight/

---

## Implementation Status

**Current Status:** ✅ **PHASES 1-6 COMPLETE!** Ready for EAS Build & Sandbox Testing

**Last Updated:** 2025-12-04 18:55

**Implementation Complete:**
- ✅ **Phase 1:** Setup & Configuration ✅
- ✅ **Phase 2:** Package Installation & SDK Setup ✅
- ✅ **Phase 3:** Service Layer Implementation ✅
- ✅ **Phase 4:** UI Components ✅
- ✅ **Phase 5:** Auth Provider Integration ✅
- ✅ **Phase 6:** Server-Side Webhook ✅
- ✅ **Code Quality:** 7 critical fixes applied ✅
- ✅ **Pre-Build:** All checks passed ✅
- ⏳ **Phase 7:** Sandbox Testing (NEXT - requires EAS build)
- ⏳ **Phase 8:** Production Deployment (PENDING)

---

## ✅ What Was Completed (2025-12-04)

### **Phase 1: Setup & Configuration**
- ✅ RevenueCat account created (free tier)
- ✅ BoothBrain project in RevenueCat
- ✅ iOS app configured (Bundle ID: com.boothbrain.app)
- ✅ App Store Connect subscription created:
  - Product ID: `boothbrain_pro_quarterly`
  - Price: $29.99 / 3 months
  - Display: "BoothBrain Pro"
- ✅ App-Specific Shared Secret obtained
- ✅ App Store Connect API key (P8) generated
- ✅ RevenueCat product linked to entitlement "BoothBrain Pro"
- ✅ API keys configured in `.env` and `eas.json`
- ✅ Platform detection (Android "Coming Soon")

### **Phase 2: Package Installation**
- ✅ `react-native-purchases` installed
- ✅ `expo-crypto` installed (for 2FA recovery codes)
- ✅ Database migration applied (apple_iap_fields)
- ✅ Recovery codes migration applied

### **Phase 3: Service Layer**
- ✅ `revenuecatService.ts` (186 lines) - SDK wrapper
- ✅ `subscriptionSync.ts` (159 lines) - Supabase sync
- ✅ `subscriptionStatusMapper.ts` (69 lines) - Status mapping
- ✅ `planCache.ts` (55 lines) - Plan ID caching
- ✅ `subscriptionService.ts` updated - Apple support

### **Phase 4: UI Components**
- ✅ `SubscriptionModal.tsx` (445 lines) - Complete purchase UI
- ✅ `RecoveryCodesModal.tsx` (356 lines) - 2FA recovery codes
- ✅ Settings screen updated (iOS/Android detection)

### **Phase 5: Auth Provider Integration**
- ✅ RevenueCat initialization on sign in
- ✅ Customer info update listener (with cleanup fix!)
- ✅ Automatic subscription sync
- ✅ RevenueCat logout on sign out
- ✅ Memory leak fixed

### **Phase 6: Server-Side Webhook**
- ✅ `revenuecat-webhook/index.ts` (207 lines)
- ✅ Handles 5 event types (INITIAL_PURCHASE, RENEWAL, etc.)
- ✅ Deployment guide created
- ✅ Ready for production deployment

### **Code Quality Fixes:**
- ✅ Fix #1: Memory leak in listener (CRITICAL)
- ✅ Fix #2: Transaction ID uniqueness (CRITICAL)
- ✅ Fix #3: Duplicate status mapping (HIGH)
- ✅ Fix #4: 2FA crypto compatibility (CRITICAL)
- ✅ Fix #5: Inefficient DB queries (MEDIUM)
- ✅ Fix #6: Error recovery in purchases (MEDIUM)
- ✅ Fix #7: RevenueCat key in eas.json (CRITICAL)

### **Testing & Documentation:**
- ✅ Expo Go testing completed
- ✅ 7 documentation guides created (3,614 lines)
- ✅ Pre-build checklist created
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors

---

## 📊 Implementation Summary

**Files Created:** 18 files (2,914 lines of code)
**Files Modified:** 13 files
**Documentation:** 7 guides (3,614 lines)
**Total Changes:** 32 files, 6,527 lines added
**Commits:** 20+ commits, all merged to master
**Code Quality:** ✅ 100% TypeScript typed, 0 errors

**Next Phase:** Phase 7 - Sandbox Testing
**Command:** `eas build --profile preview --platform ios`
**Estimated Time:** 15-20 min build + 2-3 hours testing

---

## Notes & Decisions

### Why RevenueCat?
After analyzing the codebase, RevenueCat is the clear choice because:
1. Existing complex subscription logic (pause, trial, status)
2. Server-side validation is critical for security
3. Team velocity - building custom validation = 3-5 extra days
4. Future-proof for Google Play (one SDK for both platforms)

### Why Not Direct Implementation?
- Receipt validation is complex and security-sensitive
- Edge cases (refunds, upgrades, grace periods) are handled by RevenueCat
- Webhook setup is simplified
- More time to focus on core app features

### Database Design Decision
- Keep existing `subscriptions` table structure
- Add `payment_platform` field to distinguish providers
- Both Stripe and Apple write to same table
- Existing subscription logic (pause, tier checks) works unchanged

---

**END OF IMPLEMENTATION PLAN**

✅ Plan is complete and ready for execution!
👉 Start with Phase 1 when ready to begin implementation.
