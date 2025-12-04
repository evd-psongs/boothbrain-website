# Android Payment Strategy

**Project:** BoothBrain Pro Subscription
**Date Created:** 2025-12-03
**Status:** Strategy Planning

---

## The Android Question

Before implementing Apple IAP, we need to decide the Android monetization strategy since:
- ✅ App is cross-platform (iOS + Android configured in `app.config.ts`)
- ⚠️ Google Play has similar IAP requirements as Apple
- 🤔 Multiple payment options available

---

## Google Play Store Requirements

### What Google Requires (Similar to Apple)

**Google Play Billing Policy:**
- Apps distributed on Google Play **must use Google Play Billing** for:
  - ✅ Digital subscriptions (like BoothBrain Pro)
  - ✅ In-app features or content
  - ✅ Virtual goods consumed in the app

**Google's Cut:**
- 15% for first $1M in revenue per year
- 30% after $1M
- **Better than Apple:** All subscriptions are 15% (no matter how long subscribed)

**Compliance:**
- Similar to Apple, Google will reject apps using external payment methods (Stripe) for subscriptions
- Policy updated November 2021 - strictly enforced since 2022

---

## Android Strategy Options

### Option 1: Google Play Billing (Recommended for Play Store)

**Overview:**
- Use Google Play In-App Billing for Android subscriptions
- RevenueCat supports Google Play alongside Apple IAP
- Same subscription products, same pricing, unified management

**Pros:**
✅ Play Store compliant (required for distribution)
✅ RevenueCat handles both iOS and Android with one SDK
✅ Unified subscription management across platforms
✅ Built-in billing features (pause, grace periods, etc.)
✅ Better commission rate than Apple (15% vs 30%)
✅ Familiar payment flow for Android users
✅ Family Library sharing support

**Cons:**
❌ Google takes 15% cut
❌ Additional setup required (Google Play Console)
❌ Testing requires Google Play Internal Testing track
❌ More complexity (3 payment systems: Apple, Google, Stripe)

**Implementation Effort:**
- **Additional time:** +2-3 days on top of Apple IAP implementation
- **Complexity:** Medium (RevenueCat handles most of it)
- **Code changes:** Minimal (same RevenueCat SDK, just configure Android)

**Use When:**
- Planning to distribute on Google Play Store
- Want consistent subscription experience across platforms
- Long-term monetization strategy

---

### Option 2: Stripe Only (Alternative Distribution)

**Overview:**
- Keep Stripe for subscriptions on Android
- Distribute outside Google Play Store (sideloading, web download)
- Google can't enforce policies on non-Play Store apps

**Pros:**
✅ Keep Stripe (you keep 97% vs 85% with Google)
✅ No additional IAP implementation needed
✅ More control over payment flow
✅ Can offer web-based subscription portal
✅ Faster updates (no Play Store review)

**Cons:**
❌ Can't distribute on Google Play Store (major discovery channel)
❌ Users must enable "Install from Unknown Sources"
❌ Loses credibility/trust from official store presence
❌ No automatic updates (must build custom update mechanism)
❌ Harder to reach Android users
❌ Marketing challenge (Android users expect Play Store)

**Implementation Effort:**
- **Additional time:** 0 (already have Stripe)
- **Complexity:** Low (existing implementation)
- **Code changes:** None needed

**Use When:**
- Targeting tech-savvy users who understand sideloading
- B2B customers who manage their own app distribution
- Want to avoid Play Store fees
- Already have strong direct distribution channel

---

### Option 3: Hybrid Approach (Best of Both)

**Overview:**
- Play Store version: Use Google Play Billing
- Direct APK distribution: Use Stripe
- Different app bundles with different payment providers

**Pros:**
✅ Play Store presence for discovery
✅ Direct distribution option for lower fees
✅ Flexibility for users to choose
✅ Can offer discounts on direct version (since no 15% fee)

**Cons:**
❌ Most complex to maintain
❌ Two Android builds to manage
❌ Confusing for users (which version to download?)
❌ Marketing complexity (explaining two versions)
❌ Potential Play Store policy violation (directing users to external version)

**Implementation Effort:**
- **Additional time:** +4-5 days (two payment systems + two builds)
- **Complexity:** High
- **Code changes:** Build variants, conditional payment logic

**Use When:**
- You have resources to maintain multiple builds
- Strong direct marketing channel
- Want to maximize revenue from direct users
- Willing to manage complexity

---

### Option 4: Delay Android Monetization

**Overview:**
- Launch iOS with Apple IAP first
- Android stays free (no Pro features)
- Add Google Play Billing later as Phase 2

**Pros:**
✅ Focus on one platform first (reduce scope)
✅ Learn from iOS launch before tackling Android
✅ Faster time to market
✅ Test monetization model with iOS users first
✅ Can still build Android user base

**Cons:**
❌ Android users can't subscribe to Pro
❌ Missing revenue from Android market
❌ Feature parity issues (iOS has Pro, Android doesn't)
❌ Confusing messaging ("Pro available on iOS only")

**Implementation Effort:**
- **Additional time:** 0 (defer to later)
- **Complexity:** Low (hide Pro features on Android)
- **Code changes:** Platform detection to disable Pro features on Android

**Use When:**
- Want to ship Apple version ASAP
- Limited development resources right now
- iOS is your primary market
- Can add Android billing in 1-2 months

---

## Recommended Strategy

### 🎯 **Recommendation: Option 1 (Google Play Billing) + Option 4 (Phased Rollout)**

**Phase 1: iOS Launch (Current Focus)**
1. Implement Apple IAP (1-2 weeks)
2. Submit to App Store
3. Launch iOS Pro subscriptions
4. Android builds but Pro features hidden/disabled
5. Android users see "Pro coming soon to Android"

**Phase 2: Android Launch (1-2 months later)**
1. Set up Google Play Console
2. Configure Google Play Billing products
3. Update RevenueCat to include Android
4. Enable Pro features for Android
5. Submit to Play Store

**Why This Approach:**
- ✅ **Focus:** One payment system at a time
- ✅ **Risk mitigation:** Test iOS monetization first
- ✅ **Time to market:** Ship faster, iterate based on feedback
- ✅ **Resource management:** Spread implementation work over time
- ✅ **Future-proof:** Sets up proper Play Store distribution
- ✅ **Revenue:** Start earning from iOS users immediately

---

## Google Play Billing Implementation Overview

### What You'll Need (For Phase 2)

#### 1. Google Play Console Setup
- Create subscription products (same as iOS)
- Set pricing (Google converts to local currencies automatically)
- Configure subscription group
- Add billing descriptions

#### 2. RevenueCat Configuration
- Add Android app to RevenueCat project
- Link Google Play service credentials
- Map products to entitlements (same "pro" entitlement)

#### 3. Code Updates (Minimal)
```typescript
// app.config.ts - Add RevenueCat Android config
export default {
  plugins: [
    [
      "react-native-purchases",
      {
        "apiKey": process.env.REVENUECAT_PUBLIC_API_KEY_IOS,
        "androidApiKey": process.env.REVENUECAT_PUBLIC_API_KEY_ANDROID, // Add this
      }
    ]
  ]
}
```

#### 4. Service Updates
```typescript
// src/lib/purchases/revenuecatService.ts
export async function initializeRevenueCat(userId: string): Promise<void> {
  // Already handles both iOS and Android!
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return; // Skip for web
  }

  const apiKey = Platform.OS === 'ios'
    ? REVENUECAT_API_KEY_IOS
    : REVENUECAT_API_KEY_ANDROID;

  await Purchases.configure({ apiKey, appUserID: userId });
}
```

**That's it!** RevenueCat handles the platform differences automatically.

---

## Cost Analysis

### Revenue Comparison (Based on $27/quarter subscription)

**Scenario: 100 subscribers per month**

| Platform | Payment Method | Revenue/Year | After Fees | Your Take |
|----------|---------------|--------------|------------|-----------|
| iOS | Apple IAP | $32,400 | -$9,720 (30%) | **$22,680** |
| Android | Google Play | $32,400 | -$4,860 (15%) | **$27,540** |
| Android | Stripe | $32,400 | -$972 (3%) | **$31,428** |
| Web | Stripe | $32,400 | -$972 (3%) | **$31,428** |

**Key Insights:**
- Google Play fees are **half** of Apple's (15% vs 30%)
- Android via Play Store yields $4,860 more per year than iOS
- Direct Stripe adds $3,888 more than Play Store
- But: Play Store provides discovery worth far more than $3,888

**Conclusion:** Google Play Billing is worth it for the distribution reach, even with 15% fee.

---

## Platform Detection Strategy

### Current State
Your app already has Android configuration:
- ✅ `android.package`: `com.boothbrain.app`
- ✅ `google-services.json` present (Firebase)
- ✅ Adaptive icon configured
- ✅ Navigation bar styling set

### Code Changes Needed for Phased Rollout

**File:** `src/utils/platform.ts` (update)
```typescript
import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Check if Pro subscriptions are available on this platform
 */
export function isProSubscriptionAvailable(): boolean {
  // Phase 1: iOS only
  if (isIOS) return true;

  // Phase 2: Enable Android (uncomment when Google Play Billing is ready)
  // if (isAndroid) return true;

  return false;
}

/**
 * Get payment provider for current platform
 */
export function getPaymentProvider(): 'apple' | 'google' | 'stripe' | 'none' {
  if (isIOS) return 'apple';
  if (isAndroid) return 'none'; // Change to 'google' in Phase 2
  return 'stripe'; // Web fallback
}
```

**File:** `app/(tabs)/settings.tsx`
```typescript
import { isProSubscriptionAvailable } from '@/utils/platform';

// In render:
{isProSubscriptionAvailable() ? (
  <SubscriptionModal ... />
) : (
  <View style={styles.comingSoonCard}>
    <Text style={styles.comingSoonText}>
      Pro subscriptions coming soon to Android!
    </Text>
  </View>
)}
```

---

## Testing Considerations

### iOS Testing (Current)
- ✅ TestFlight with sandbox Apple ID
- ✅ Physical device required
- ✅ Fast iterations (5-min renewal in sandbox)

### Android Testing (Phase 2)
- ✅ Google Play Internal Testing track
- ✅ Physical device or emulator works
- ✅ Faster than iOS (instant purchase in test mode)
- ⚠️ Must publish to Internal Testing (can't test locally)

### Web Testing (Future)
- ✅ Stripe Test Mode
- ✅ Instant testing (no app review needed)
- ✅ Can test in browser

---

## Migration Path

### Phase 1: iOS Only (Weeks 1-2)
1. ✅ Implement Apple IAP (see APPLE_IAP_IMPLEMENTATION_PLAN.md)
2. ✅ Add platform detection (disable Pro on Android)
3. ✅ Test on iOS devices
4. ✅ Submit to App Store
5. ✅ Launch iOS Pro subscriptions

**Android state:** App works, Pro features hidden, free tier fully functional

### Phase 2: Android Preparation (Week 3-4)
1. Set up Google Play Console
2. Create Google Play Billing products
3. Configure RevenueCat for Android
4. Update environment variables
5. Test on Internal Testing track

**iOS state:** Live and earning revenue

### Phase 3: Android Launch (Week 5-6)
1. Enable Pro features on Android
2. Update platform detection
3. Submit to Play Store
4. Launch Android Pro subscriptions

**Both platforms:** Live with Pro subscriptions

### Phase 4: Web (Optional - Month 3+)
1. Build web version with Stripe
2. Sync subscriptions across all platforms
3. Offer web as alternative for direct purchases

---

## Questions to Answer Now

### Business Decisions
1. **Target market:** Are you iOS-first, or is Android equally important?
2. **Launch urgency:** Do you need to ship immediately, or can you wait for both platforms?
3. **Resources:** Do you have bandwidth to implement two payment systems now?
4. **Revenue expectations:** Do you need Android revenue immediately?

### Technical Decisions
1. **Android distribution:** Play Store only, or also direct APK?
2. **Feature parity:** Should Android have all features except Pro, or reduced feature set?
3. **Messaging:** How do you explain to Android users why Pro isn't available yet?

---

## My Recommendation

**Start with iOS Apple IAP (Option 4 - Phased Rollout)**

**Rationale:**
1. **Apple rejects first:** App Store review is stricter - if you're going to face rejection, better to find out from Apple first
2. **iOS monetizes better:** Historically, iOS users have higher willingness to pay
3. **Test pricing:** Validate $27/quarter pricing with iOS users before building Android
4. **Reduce scope:** Ship faster, learn faster, iterate faster
5. **RevenueCat is ready:** When you want to add Android, it's just configuration (2-3 days of work)

**Timeline:**
- **Now - Week 2:** Implement Apple IAP, launch iOS
- **Week 3-8:** Monitor iOS metrics, gather feedback, optimize
- **Week 8-10:** Implement Google Play Billing, launch Android

**Alternative (If Android is Equally Important):**
- Implement both Apple IAP and Google Play Billing together
- Add +3-4 days to timeline (total 2-3 weeks for both)
- Launch both platforms simultaneously
- More complexity but unified launch

---

## Action Items

**Before Making Decision:**
- [ ] Check your user analytics - what % are iOS vs Android users?
- [ ] Review Play Store requirements in detail
- [ ] Decide if you want simultaneous launch or phased
- [ ] Confirm budget for platform fees (15-30% commission)

**If Choosing Phased Approach:**
- [ ] Proceed with Apple IAP implementation (see main plan)
- [ ] Add "Pro coming to Android soon" messaging
- [ ] Plan Phase 2 (Google Play) for 1-2 months out

**If Choosing Simultaneous Launch:**
- [ ] Update main implementation plan to include Android
- [ ] Set up Google Play Console account
- [ ] Allocate 2-3 weeks for full implementation

---

## Summary

**Short Answer:**
Google Play Store requires Google Play Billing for subscriptions, just like Apple requires Apple IAP.

**Recommended Path:**
1. Launch iOS with Apple IAP first (1-2 weeks)
2. Add Google Play Billing for Android later (1-2 months)
3. Use RevenueCat to manage both platforms from one SDK

**Why:**
- Reduces scope and ships faster
- Tests monetization model with iOS first
- Android users can still use free tier
- Easy to add Google Play Billing later

**What do you think?** Should we:
- **A)** Focus on iOS only for now (phased rollout)
- **B)** Implement both iOS and Android together (simultaneous launch)
- **C)** Something else?

---

**Last Updated:** 2025-12-03
