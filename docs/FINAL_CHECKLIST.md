# BoothBrain - Final Production Checklist

**Status:** Ready for final testing and submission preparation

---

## ✅ COMPLETED

### Code Quality
- [x] Zero TypeScript errors (`npm run typecheck`)
- [x] Zero ESLint errors (`npm run lint`)
- [x] All Stripe webhook errors fixed
- [x] Biometric authentication implemented
- [x] Session persistence working
- [x] iOS timeout/loading issues fixed

### Documentation
- [x] Privacy Policy created
- [x] Terms of Service created
- [x] App Store descriptions written
- [x] Keywords optimized
- [x] FAQ/Support content ready
- [x] Email templates prepared

### Website
- [x] Website files created (index, privacy, terms, support)
- [x] Professional styling complete
- [x] Mobile responsive design
- [x] Ready to deploy to GitHub Pages

### Configuration
- [x] Support email configured (song.sopaul@gmail.com)
- [x] App name set to "BoothBrain"
- [x] Bundle identifiers configured
- [x] Biometric permissions added
- [x] Firebase Crashlytics integrated

---

## 🔴 CRITICAL - Must Complete Before Submission

### 1. Deploy Website ⏱️ 10 minutes
**Priority: CRITICAL** - App stores will reject without working URLs

- [ ] Create GitHub account
- [ ] Create `boothbrain-website` repository
- [ ] Upload website files
- [ ] Enable GitHub Pages
- [ ] Verify all pages load:
  - [ ] Homepage
  - [ ] Privacy Policy
  - [ ] Terms of Service
  - [ ] Support page
- [ ] Copy final URLs for app store forms

**URLs will be:**
```
https://YOUR_USERNAME.github.io/boothbrain-website/privacy.html
https://YOUR_USERNAME.github.io/boothbrain-website/terms.html
https://YOUR_USERNAME.github.io/boothbrain-website/support.html
```

### 2. Design App Icon ⏱️ 1-3 days
**Priority: CRITICAL** - Current icon is black placeholder

**Current Status:** ⚠️ Placeholder (solid black 1024×1024 PNG)

**Options:**
- **A) Hire Designer** (Recommended)
  - Fiverr: $20-50 (2-3 days)
  - 99designs: $100-300 (higher quality)
  - Upwork: $50-150

- **B) DIY Tools**
  - Canva Pro (free trial): Create simple logo
  - Adobe Express: Icon templates
  - Figma: Design from scratch

**Requirements:**
- 1024×1024 px (iOS)
- 512×512 px (Android)
- No transparency
- No rounded corners (OS adds them)
- Should represent: inventory/booth/sales concept

**Action:** Decide approach and create/order icon

### 3. Create App Screenshots ⏱️ 2-4 hours
**Priority: CRITICAL** - Required for App Store

**iOS Requirements:**
- iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max): 3-10 screenshots
- iPhone 6.5" (iPhone 11 Pro Max): 3-10 screenshots
- iPad 12.9" (iPad Pro): 3-10 screenshots (optional)

**Android Requirements:**
- Phone screenshots: 2-8 screenshots
- Minimum 320px, maximum 3840px

**Screenshot Ideas** (from APP_STORE_LISTING.md):
1. Inventory list with product photos
2. Add/Edit product screen
3. Point-of-sale checkout with cart
4. Sales analytics dashboard
5. Event management screen
6. Session tracking view
7. Payment method selection

**How to Create:**
1. Build preview/production app
2. Install on physical device OR use iOS Simulator
3. Add sample data (see Demo Account below)
4. Take screenshots of each screen
5. Optional: Add text overlays with tools like:
   - Screenshot.rocks (free)
   - Previewed.app
   - App Store Screenshot Generator

**Action:** Build app → Add sample data → Take screenshots

---

## 🟡 IMPORTANT - Should Complete Before Submission

### 4. Create Demo Account ⏱️ 30 minutes
**Priority: HIGH** - Apple reviewers need working account

**Create test account:**
- Email: `demo@boothbrain.app` (or use temp email service)
- Password: Strong password (save it securely)
- Pre-populate with sample data:
  - [ ] 10-20 inventory items with photos
  - [ ] 2-3 events (past, current, future)
  - [ ] 1 active session with sales data
  - [ ] Various payment methods configured
  - [ ] Some completed transactions

**For App Review Notes:**
```
TEST ACCOUNT CREDENTIALS
Email: demo@boothbrain.app
Password: [your-password]

HOW TO TEST:
1. Login with credentials above
2. View Inventory tab to see sample products
3. Tap Events tab → Select event → "Start Session"
4. Go to Sale tab → Add items to cart → Complete checkout
5. View Analytics to see sales reports
6. Biometric authentication triggers when app resumes

PAYMENTS: Using Stripe test mode
CONTACT: song.sopaul@gmail.com
```

### 5. Test Critical Flows ⏱️ 2-3 hours
**Priority: HIGH** - Prevent rejections and bugs

**Build test app first:**
```bash
eas build --platform ios --profile preview
# or
eas build --platform android --profile preview
```

**Test on Physical Devices:**

**iOS Device Testing:**
- [ ] App launches without crashing
- [ ] Sign up new account
- [ ] Login existing account
- [ ] Update profile
- [ ] Add inventory item (with photo)
- [ ] Edit inventory item
- [ ] Delete inventory item
- [ ] Import CSV
- [ ] Export CSV
- [ ] Create event
- [ ] Start session
- [ ] Add items to cart
- [ ] Apply discount
- [ ] Process payment (each method: cash, card, Venmo)
- [ ] End session
- [ ] View analytics
- [ ] Face ID authentication on app resume
- [ ] Password reset
- [ ] Subscription flow (if testing payments)
- [ ] Offline mode (airplane mode)
- [ ] App works after force quit and reopen
- [ ] No console errors or crashes

**Android Device Testing:**
- [ ] All flows above
- [ ] Fingerprint authentication
- [ ] Back button works correctly
- [ ] Permissions requested correctly

**Performance Testing:**
- [ ] App loads in < 3 seconds
- [ ] Smooth scrolling (60fps)
- [ ] No memory leaks
- [ ] Works with poor internet connection

### 6. Apple & Google Developer Accounts ⏱️ 1 hour
**Priority: HIGH** - Needed to submit

- [ ] **Apple Developer Account** ($99/year)
  - Go to: https://developer.apple.com/programs/enroll/
  - Complete enrollment
  - Wait 24-48 hours for approval

- [ ] **Google Play Developer Account** ($25 one-time)
  - Go to: https://play.google.com/console/signup
  - Complete registration
  - Usually approved within hours

---

## 🟢 FINAL BUILD & SUBMISSION

### 7. Final Payment Testing ⏱️ 1 hour
**Priority: MEDIUM** - Test before switching to live keys

**With Test Stripe Keys:**
- [ ] Test subscription purchase
- [ ] Test subscription cancellation
- [ ] Test payment failure scenarios
- [ ] Verify webhooks working
- [ ] Check Stripe dashboard for test transactions

### 8. Switch to Live Stripe Keys ⏱️ 15 minutes
**Priority: CRITICAL** - Only do this AFTER payment testing complete!

**Update these locations:**
1. [ ] `eas.json` line 28:
   ```
   "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_YOUR_LIVE_KEY"
   ```

2. [ ] Supabase Edge Functions (Dashboard → Edge Functions → Secrets):
   ```
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
   ```

3. [ ] Update Stripe webhook URL to point to production

4. [ ] Test with live keys in test mode FIRST

### 9. Build Production Apps ⏱️ 30-60 minutes
**Priority: CRITICAL** - Final builds for submission

**Pre-build Checklist:**
- [ ] All tests passing
- [ ] Using LIVE Stripe keys
- [ ] Version number updated in app.config.ts
- [ ] All URLs verified working
- [ ] Demo account ready
- [ ] Screenshots ready
- [ ] App icon ready

**Build Commands:**
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Both
eas build --platform all --profile production
```

**After build completes:**
- [ ] Download .ipa (iOS) and .aab (Android)
- [ ] Test builds on physical devices
- [ ] Verify no crashes or errors

### 10. Submit to App Stores ⏱️ 2-3 hours
**Priority: CRITICAL** - Final step!

**App Store Connect (iOS):**
- [ ] Create app listing
- [ ] Upload app icon (1024×1024)
- [ ] Upload screenshots (all required sizes)
- [ ] Add app description (from APP_STORE_LISTING.md)
- [ ] Add keywords
- [ ] Set pricing/subscriptions
- [ ] Add privacy policy URL
- [ ] Add support URL
- [ ] Configure in-app purchases
- [ ] Add demo account in App Review Information
- [ ] Add review notes
- [ ] Upload .ipa build
- [ ] Submit for review

**Google Play Console (Android):**
- [ ] Create app listing
- [ ] Upload app icon (512×512)
- [ ] Upload feature graphic (1024×500)
- [ ] Upload screenshots
- [ ] Add app description (from APP_STORE_LISTING.md)
- [ ] Add keywords
- [ ] Set pricing/subscriptions
- [ ] Add privacy policy URL
- [ ] Add support email
- [ ] Configure in-app billing
- [ ] Complete content rating
- [ ] Add demo account in notes
- [ ] Upload .aab build
- [ ] Submit for review

---

## 📊 Timeline Estimate

| Task | Time | When |
|------|------|------|
| Deploy website | 10 min | NOW |
| Order app icon | 5 min | NOW (wait 2-3 days) |
| Developer accounts | 1 hour | NOW (wait 24-48 hours) |
| Build test app | 30 min | While waiting for icon |
| Create demo account | 30 min | While waiting for icon |
| Test critical flows | 2-3 hours | After test build |
| Create screenshots | 2 hours | After testing complete |
| Final payment testing | 1 hour | After screenshots |
| Switch to live keys | 15 min | After payment testing |
| Production builds | 1 hour | After live keys |
| App store setup | 2-3 hours | After builds ready |
| **TOTAL** | **~15-20 hours** | **3-5 days** |

---

## 🎯 Recommended Order

### Day 1 (Today):
1. ✅ Deploy website to GitHub Pages (10 min)
2. ✅ Register Apple Developer account ($99)
3. ✅ Register Google Play Developer account ($25)
4. ✅ Order/create app icon (start design process)

### Day 2-3 (While waiting for accounts/icon):
5. ✅ Build preview app
6. ✅ Create demo account with sample data
7. ✅ Test all critical flows on physical devices

### Day 4 (Icon ready):
8. ✅ Create app screenshots
9. ✅ Test payment flows with test Stripe keys
10. ✅ Switch to live Stripe keys

### Day 5 (Final):
11. ✅ Build production apps
12. ✅ Set up App Store Connect listing
13. ✅ Set up Google Play Console listing
14. ✅ Submit both apps for review

---

## 🚨 Common Rejection Reasons (Avoid These!)

### Apple App Store:
- ❌ Privacy policy URL doesn't work → ✅ Deploy website first
- ❌ App crashes on launch → ✅ Test on physical device
- ❌ Missing features in screenshots → ✅ Use real screenshots
- ❌ Test account doesn't work → ✅ Verify demo account
- ❌ Subscription not functional → ✅ Configure StoreKit

### Google Play:
- ❌ Content rating incomplete → ✅ Complete questionnaire
- ❌ Privacy policy missing → ✅ Add URL in console
- ❌ Permissions not justified → ✅ Explain in description
- ❌ Target API level too old → ✅ Using Expo SDK 54 (should be fine)

---

## 📞 Resources

**EAS Build:**
- Docs: https://docs.expo.dev/build/introduction/
- Run: `eas build --platform all --profile production`

**App Store Connect:**
- URL: https://appstoreconnect.apple.com
- Help: https://developer.apple.com/help/app-store-connect/

**Google Play Console:**
- URL: https://play.google.com/console
- Help: https://support.google.com/googleplay/android-developer

**Stripe:**
- Dashboard: https://dashboard.stripe.com
- Test vs Live: https://stripe.com/docs/keys

---

## ✅ Final Verification Before Submit

- [ ] Website live and all URLs work
- [ ] App icon looks professional (not placeholder)
- [ ] All screenshots uploaded
- [ ] Demo account works perfectly
- [ ] Tested on real devices (iOS + Android)
- [ ] Using LIVE Stripe keys
- [ ] Privacy/Terms/Support URLs in app store listings
- [ ] App description has no typos
- [ ] Version number is correct
- [ ] No console errors or warnings
- [ ] Deep breath taken 😊

---

## 🎉 After Submission

**Review Timeline:**
- **Apple:** 1-3 days typically (can be 24 hours or 1 week)
- **Google:** Few hours to 7 days

**While Waiting:**
- Monitor email for review updates
- Prepare marketing materials
- Plan launch announcement
- Set up social media accounts (optional)
- Create promotional graphics

**If Rejected:**
- Read rejection reason carefully
- Fix the issue
- Respond to reviewer if needed
- Resubmit quickly

**If Approved:**
- 🎉 Celebrate!
- Update website with real app store links
- Announce launch
- Monitor crash reports
- Respond to reviews
- Plan first update

---

**You're almost there! Start with Day 1 tasks today!** 🚀
