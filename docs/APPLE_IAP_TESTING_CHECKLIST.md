# Apple IAP Testing Checklist - Phase 7

Quick reference guide for testing Apple In-App Purchases in sandbox.

📚 **Full Testing Guide:** See `APPLE_IAP_IMPLEMENTATION_PLAN.md` (lines 1194-1656) for detailed step-by-step instructions.

---

## ⚠️ Important: Expo Go NOT Supported

**Apple IAP will NOT work in Expo Go!**

- ❌ Expo Go doesn't include RevenueCat native modules
- ❌ You'll see errors: `[RevenueCat] Missing API key, skipping initialization`
- ✅ These errors are safe and won't crash your app
- ✅ You can still test UI/UX in Expo Go

**For actual IAP testing, you MUST use:**
- TestFlight build (via EAS)
- Development build (via `npx expo run:ios`)
- Production App Store build

---

## Prerequisites Checklist

### ✅ Before Testing

- [ ] **Phases 1-6 complete** (code implemented and committed)
- [ ] **Physical iOS device** available (iPhone or iPad, iOS 15.1+)
- [ ] **TestFlight build** created OR **Xcode development build** ready
- [ ] **NOT using Expo Go** (won't work for IAP testing)
- [ ] **Sandbox test accounts** created in App Store Connect
- [ ] **Signed out** of real App Store account on device

---

## Quick Start: First Test (15 minutes)

### Step 1: Create Sandbox Test Account (5 min)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Sandbox → Testers
2. Create test account:
   - Email: `test-quarterly@boothbrain.com` (fake email, doesn't need to be real)
   - Password: (create strong password, save it!)
   - Country: United States
3. Save the password - you'll need it!

### Step 2: Prepare Device (2 min)

1. **On iPhone:** Settings → App Store → Sign Out (of real account)
2. **Don't sign into sandbox account yet** - it only works when triggered by in-app purchase

### Step 3: Build & Install App (3 min)

**Option A: TestFlight (Recommended)**
```bash
npm run ship:ios
npm run submit:ios
```
Wait for build to process, then install via TestFlight app

**Option B: Xcode Development Build**
```bash
npx expo run:ios
```

### Step 4: Test Purchase Flow (5 min)

1. Open BoothBrain app
2. Sign in with BoothBrain account
3. Go to Settings tab
4. Tap **"View Plans"**
5. Select **"Quarterly"** package
6. Tap **"Subscribe Now"**
7. When prompted, sign in with sandbox account (`test-quarterly@boothbrain.com`)
8. Confirm purchase (it's free in sandbox!)
9. ✅ Modal closes, success message appears
10. ✅ Settings shows "Pro" status

### Step 5: Verify Database (1 min)

Check Supabase:
```sql
SELECT * FROM subscriptions
WHERE payment_platform = 'apple'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `status` = `'active'`
- `apple_product_id` = `'boothbrain_pro_quarterly'`
- `current_period_end` = ~15 minutes from now

---

## Full Test Suite (2-3 hours)

### Core Tests (Required)

#### ✅ Test 1: Purchase Flow
- [ ] Modal shows 3 packages (if you created monthly/yearly)
- [ ] Select package → visual feedback
- [ ] Tap Subscribe → Apple payment sheet appears
- [ ] Sign in with sandbox account → confirms purchase
- [ ] Success! → Modal closes, settings shows "Pro"
- [ ] Database updated with subscription

#### ✅ Test 2: Restore Purchases
- [ ] Delete app from device
- [ ] Reinstall via TestFlight/Xcode
- [ ] Sign into BoothBrain
- [ ] Settings shows "Free" (subscription not restored yet)
- [ ] Tap "View Plans" → "Restore Purchases"
- [ ] Enter same sandbox account
- [ ] Success! → Pro status restored

#### ✅ Test 3: Auto-Renewal (15 min)
- [ ] Note time after purchase
- [ ] Wait 15 minutes (quarterly renews every 15 min in sandbox)
- [ ] Check database: `current_period_end` extended by 15 min
- [ ] Status still `'active'`
- [ ] Pro features still work

#### ✅ Test 4: Cancellation
- [ ] iPhone Settings → Your Name → Subscriptions
- [ ] Find "BoothBrain Pro" → Cancel Subscription
- [ ] In app: Still shows Pro (active until expiration)
- [ ] Wait until `current_period_end` passes
- [ ] App auto-detects: Pro features lock, shows "Free"
- [ ] Database: `status` = `'canceled'`

### Optional Tests (Recommended)

#### ⭐ Test 5: User Cancels Purchase
- [ ] Start purchase flow
- [ ] When Apple sheet appears → tap "Cancel"
- [ ] No error shown (graceful)
- [ ] Modal still open, can retry

#### ⭐ Test 6: Network Issues
- [ ] Enable Airplane Mode
- [ ] Try to purchase
- [ ] Clear error message shown
- [ ] Disable Airplane Mode → retry works

#### ⭐ Test 7: Multiple Renewals
- [ ] After initial purchase, wait 90 minutes
- [ ] Sandbox auto-renews 6 times (every 15 min)
- [ ] After 6th renewal, auto-cancels (tests expiration)
- [ ] Verify status changes to `'canceled'`

---

## Webhook Testing (Optional)

### Deploy Webhook

```bash
supabase functions deploy revenuecat-webhook
```

### Configure in RevenueCat

1. RevenueCat Dashboard → Integrations → Webhooks
2. Add URL: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
3. Select events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE
4. Save

### Test Webhook

1. Send test event from RevenueCat dashboard
2. Check logs:
   ```bash
   supabase functions logs revenuecat-webhook
   ```
3. Verify database updated

---

## Sandbox Renewal Times

| Real Duration | Sandbox Time | Use For |
|---------------|-------------|---------|
| 3 months (Quarterly) | **15 minutes** | Your main plan |
| 1 month | 5 minutes | If you add monthly |
| 1 year | 1 hour | If you add yearly |

**Max 6 renewals** in sandbox, then auto-cancels

---

## Common Issues & Solutions

### "Cannot connect to iTunes Store"
- ✅ Sign out of real App Store account
- ✅ Don't sign into sandbox in Settings - wait for purchase prompt

### "This Apple ID is not valid"
- ✅ Use sandbox account, not real Apple ID
- ✅ Verify app is sandbox build (TestFlight or Xcode)

### Stuck on "Verifying purchase..."
- ✅ Delete app, clear Safari cache, reinstall
- ✅ Check internet connection
- ✅ Sandbox can be flaky - just retry

### Database not updating
- ✅ Check Xcode console for errors
- ✅ Verify migration ran successfully
- ✅ Check RevenueCat dashboard for purchase event

---

## Production Readiness Checklist

Before final TestFlight/App Store submission:

- [ ] All core tests pass (Purchase, Restore, Renewal, Cancel)
- [ ] Database updates correctly
- [ ] Webhook deployed and configured
- [ ] RevenueCat receiving events
- [ ] No crashes or errors in logs
- [ ] UI polished (no debug text)
- [ ] Terms text accurate
- [ ] Pricing correct ($29.99/quarter)

---

## Next Steps After Testing

1. **If all tests pass:**
   - Create production build
   - Submit to App Store
   - Monitor first real purchases closely

2. **If issues found:**
   - Check Xcode console logs
   - Review RevenueCat dashboard
   - Check Supabase database
   - See troubleshooting in APPLE_IAP_IMPLEMENTATION_PLAN.md

---

## Resources

- **Full Testing Guide:** `docs/APPLE_IAP_IMPLEMENTATION_PLAN.md`
- **Webhook Deployment:** `docs/REVENUECAT_WEBHOOK_DEPLOYMENT.md`
- **Android Strategy:** `docs/ANDROID_PAYMENT_STRATEGY.md`
- **Apple Sandbox Docs:** https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox

---

## Summary

✅ **Sandbox testing is FREE** - no real charges
✅ **Fast renewals** - 15 min instead of 3 months
✅ **Complete lifecycle** - test everything in 2-3 hours
✅ **Physical device required** - simulator won't work
✅ **Sandbox accounts** - use fake emails

**Minimum viable test:** Purchase → Verify Pro unlocked → Check database (15 minutes)

**Complete test:** All 7 tests above (2-3 hours)

Good luck! 🚀
