# Expo Go Testing Guide - Apple IAP Implementation

**Date:** 2025-12-04
**Phase:** Pre-Sandbox Testing (Expo Go)
**Duration:** 30-45 minutes

---

## ⚠️ IMPORTANT: Expo Go Limitations

**Apple IAP will NOT work in Expo Go!**

RevenueCat requires native modules that aren't included in Expo Go. This is **expected and normal**.

### What You'll See in Expo Go:

```
[RevenueCat] Missing API key, skipping initialization
[Auth] RevenueCat setup failed: There is no singleton instance
```

**These errors are safe and won't crash your app.** The code is designed to handle this gracefully.

---

## What CAN Be Tested in Expo Go ✅

Even though IAP won't work, you can test:

1. **UI/UX Flow** - All screens and modals render correctly
2. **Platform Detection** - iOS shows correct UI, Android shows "Coming Soon"
3. **Error Handling** - App doesn't crash when RevenueCat unavailable
4. **Non-IAP Features** - Everything else works normally
5. **Code Quality** - No TypeScript/runtime errors from our fixes

---

## What CANNOT Be Tested in Expo Go ❌

These require EAS Build or Development Build:

- ❌ RevenueCat initialization
- ❌ Fetching subscription offerings
- ❌ Making purchases
- ❌ Restore purchases
- ❌ All IAP functionality
- ❌ Listener cleanup (can't verify without real SDK)

---

## Testing Plan for Expo Go

### Test 1: App Launch & Navigation (5 min)

**Goal:** Verify app launches without crashes despite RevenueCat errors

1. **Start Expo Go:**
   ```bash
   npm start
   ```

2. **Launch on iOS device:**
   - Scan QR code with Camera app
   - Wait for app to load

3. **Check Console:**
   - ✅ Should see: `[RevenueCat] Missing API key, skipping initialization`
   - ✅ Should see: `[Auth] RevenueCat setup failed`
   - ✅ App should **NOT** crash

4. **Navigate:**
   - Open Settings tab
   - Open Sale tab
   - Open Inventory tab
   - Open Home tab
   - ✅ All tabs load successfully

**Expected Result:** ✅ App launches and navigates normally despite RevenueCat errors

---

### Test 2: Settings Screen - iOS Platform Detection (10 min)

**Goal:** Verify iOS users see subscription UI (even though it won't work)

**On iOS Device:**

1. **Navigate to Settings tab**

2. **Scroll down to Subscription section**

3. **Verify UI:**
   - ✅ Should see "Subscription" card
   - ✅ Should see "Subscribe to Pro" button (or "View Plans" if already subscribed)
   - ✅ Button should be visible and enabled

4. **Tap "Subscribe to Pro" button:**
   - ✅ Modal should open (SubscriptionModal)
   - ✅ Should see "Upgrade to Pro" title
   - ✅ Should see "Pro Features" list with checkmarks
   - ✅ Should see loading indicator with "Loading plans..." text

5. **Wait ~5 seconds:**
   - ✅ Loading should stop
   - ✅ Should see error message: "No subscription plans available"
   - ❌ No crash should occur

6. **Tap "X" to close modal:**
   - ✅ Modal should close smoothly
   - ✅ Back to Settings screen

**Expected Result:** ✅ UI renders correctly, fails gracefully with error message

---

### Test 3: Settings Screen - Android Platform Detection (5 min)

**Goal:** Verify Android users see "Coming Soon" message

**On Android Device (if available):**

1. **Navigate to Settings tab**

2. **Scroll down to Subscription section**

3. **Verify UI:**
   - ✅ Should see "Pro Subscriptions Coming Soon" card
   - ✅ Should see message: "We're working on bringing all Pro features to Android users"
   - ✅ Should see ETA: "Expected availability: 1-2 months"
   - ❌ Should **NOT** see "Subscribe to Pro" button

**Expected Result:** ✅ Android shows different UI (Coming Soon card)

---

### Test 4: Sign In/Out Cycle - Memory Leak Fix (10 min)

**Goal:** Verify listener cleanup doesn't cause crashes (can't verify memory, but can check for errors)

1. **Sign Out:**
   - Go to Settings
   - Tap "Sign Out"
   - ✅ Sign out successful

2. **Sign In Again:**
   - Enter credentials
   - ✅ Sign in successful

3. **Check Console:**
   - ✅ Should see: `[RevenueCat] Adding customer info update listener`
   - ✅ Should see: `[RevenueCat] User logged out` (on sign out)
   - ❌ Should **NOT** see duplicate listener messages

4. **Repeat Sign Out/In 3 times:**
   - ✅ Each cycle should complete successfully
   - ✅ No crashes or errors (besides expected RevenueCat init failures)

**Expected Result:** ✅ Sign in/out works smoothly, listener cleanup doesn't cause errors

---

### Test 5: Code Quality - TypeScript & Runtime Errors (5 min)

**Goal:** Verify our fixes didn't introduce TypeScript or runtime errors

1. **Check Metro Bundler Output:**
   - ✅ No red error screens
   - ✅ No "TypeError" or "ReferenceError" messages
   - ⚠️ Yellow warnings are OK (RevenueCat init failures expected)

2. **Navigate Through All Screens:**
   - Home tab → Create event
   - Inventory tab → Add item
   - Sale tab → Add to cart
   - Settings tab → Update profile

3. **Check for Errors:**
   - ✅ All features work as before
   - ✅ No new runtime errors introduced by our fixes

**Expected Result:** ✅ App functions normally, no new errors introduced

---

### Test 6: Subscription Sync Logic - Error Handling (5 min)

**Goal:** Verify sync functions handle missing RevenueCat gracefully

This is **automatic** - just verify no crashes occur during normal app usage.

1. **Open Settings Screen:**
   - ✅ No crash when checking subscription status

2. **Sign In:**
   - ✅ No crash during auth provider initialization
   - ✅ App loads successfully even though RevenueCat fails

3. **Navigate Around:**
   - ✅ All Pro feature checks work (defaults to Free tier)
   - ✅ No crashes when accessing subscription data

**Expected Result:** ✅ App gracefully handles missing RevenueCat SDK

---

## Console Log Analysis

### Expected Logs (iOS):

```
📱 iOS Dev mode: Fast startup, session will load via onAuthStateChange
[RevenueCat] Missing API key, skipping initialization
[Auth] RevenueCat setup failed: There is no singleton instance
[SubscriptionModal] Opening modal
[SubscriptionModal] Loading plans...
[RevenueCat] Failed to get offerings: Error
[SubscriptionModal] Error: No subscription plans available
```

### Expected Logs (Android):

```
[Platform] isProSubscriptionAvailable: false (Android)
[Settings] Showing "Coming Soon" card for Android users
```

### ❌ Unexpected Logs (Report These):

- Any `TypeError` or `ReferenceError`
- Any "Cannot read property of undefined"
- Any crashes or red error screens
- Any infinite loops or repeated errors

---

## Testing Checklist

**Before You Start:**
- [ ] Latest code pulled from `test-branch`
- [ ] `npm install` run successfully
- [ ] `npm start` launches without errors
- [ ] Physical device connected to same network

**iOS Testing (Primary):**
- [ ] Test 1: App launches without crashes ✅
- [ ] Test 2: Settings screen shows subscription UI ✅
- [ ] Test 3: Modal opens and fails gracefully ✅
- [ ] Test 4: Sign in/out cycle works smoothly ✅
- [ ] Test 5: No new TypeScript/runtime errors ✅
- [ ] Test 6: Subscription sync handles missing SDK ✅

**Android Testing (Optional):**
- [ ] Test 3: "Coming Soon" card displays correctly ✅

**Code Quality:**
- [ ] No red error screens
- [ ] All existing features work
- [ ] Console shows expected RevenueCat errors only

---

## What to Report

### ✅ Success Criteria:
- App launches successfully
- UI renders correctly
- Expected "RevenueCat unavailable" errors appear
- No crashes or unexpected errors
- Sign in/out works smoothly

### 🐛 Report These Issues:
1. Any crashes or red error screens
2. Unexpected TypeScript errors
3. Features that worked before but broke
4. UI rendering issues
5. Any errors OTHER than expected RevenueCat errors

---

## After Expo Go Testing

Once Expo Go testing passes, you're ready for:

### Next: EAS Build for Sandbox Testing

**Create iOS Preview Build:**
```bash
npm run build:preview:ios
# Or manually:
eas build --profile preview --platform ios
```

**This will enable:**
- ✅ Full RevenueCat SDK functionality
- ✅ Real subscription offerings from App Store Connect
- ✅ Sandbox purchase testing
- ✅ Restore purchases testing
- ✅ Complete end-to-end flow

**Follow:** `docs/APPLE_IAP_IMPLEMENTATION_PLAN.md` Phase 7 (lines 1240-1680)

---

## Troubleshooting

### Issue: "No subscription plans available" doesn't appear
**Fix:** This is actually correct - offerings fail to load, so error appears. This is expected.

### Issue: Modal won't open
**Fix:** Check console for errors. Modal should open even if RevenueCat unavailable.

### Issue: App crashes on Settings screen
**Fix:** This is NOT expected. Report this as a bug with console logs.

### Issue: Android shows iOS subscription UI
**Fix:** Platform detection might be broken. Check `src/utils/platform.ts`

### Issue: Multiple "Adding listener" messages
**Fix:** This might indicate listener cleanup isn't working. Report with logs.

---

## Summary

**Expo Go Testing Goal:** Verify code quality and UI/UX, NOT RevenueCat functionality

**Expected Outcome:**
- ✅ App works normally
- ✅ UI renders correctly
- ✅ RevenueCat errors are expected and safe
- ✅ No crashes or unexpected errors

**Next Phase:** Create EAS build to test actual IAP functionality

**Time Required:**
- Expo Go Testing: 30-45 minutes
- EAS Build Creation: 15-20 minutes
- Sandbox Testing: 2-3 hours

---

**Ready to test?** Run `npm start` and follow the tests above! 🚀
