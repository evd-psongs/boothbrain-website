# BoothBrain Pre-Launch Checklist

Use this checklist to ensure you're ready for App Store and Google Play submission.

---

## 🔴 CRITICAL (Must Complete Before Submission)

### Code & Configuration
- [x] ~~Fix Stripe webhook parsing errors~~ (Completed 2025-11-14)
- [x] Zero TypeScript errors (`npm run typecheck`)
- [x] Zero ESLint errors (`npm run lint`)
- [ ] ⚠️ **Update app icon** (currently placeholder - needs professional 1024x1024px)
- [ ] Test biometric authentication (Face ID/Touch ID)
- [ ] Test session persistence after app restart
- [ ] Test offline mode functionality

### Stripe Configuration
- [ ] Keep test keys for final payment testing
- [ ] Test subscription flow end-to-end
- [ ] Test payment processing (all methods)
- [ ] **BEFORE FINAL BUILD:** Switch to live Stripe keys in:
  - [ ] eas.json (line 28)
  - [ ] Supabase Edge Functions secrets
  - [ ] Test with live keys in sandbox mode first

### Website Setup (Required for App Store)
- [ ] Purchase/configure domain (boothbrain.app ✓ already owned)
- [ ] Set up website hosting (GitHub Pages/Netlify/Vercel recommended)
- [ ] Create homepage (https://boothbrain.app)
- [ ] Publish privacy policy (https://boothbrain.app/privacy)
- [ ] Publish terms of service (https://boothbrain.app/terms)
- [ ] Create support page (https://boothbrain.app/support)
- [ ] **Verify all URLs are publicly accessible**

### Email Setup (Required for Support)
- [x] ✓ Email configured: song.sopaul@gmail.com
- [x] ✓ Support email: song.sopaul@gmail.com
- [x] ✓ Privacy email: song.sopaul@gmail.com
- [x] ✓ Legal email: song.sopaul@gmail.com
- [ ] Test email delivery (verify you can receive emails)
- [x] ✓ Email templates created (see SUPPORT_INFO.md)

### App Store Connect (iOS)
- [ ] Create Apple Developer account ($99/year)
- [ ] Create App Store Connect listing
- [ ] Upload app icon (1024x1024px, no transparency)
- [ ] Add app screenshots (see screenshot requirements below)
- [ ] Write app description (use APP_STORE_LISTING.md)
- [ ] Add keywords
- [ ] Set pricing/subscription info
- [ ] Add privacy policy URL
- [ ] Add support URL
- [ ] Configure in-app purchases/subscriptions
- [ ] Create demo account for reviewers
- [ ] Fill out App Review Information
- [ ] Submit for review

### Google Play Console (Android)
- [ ] Create Google Play Developer account ($25 one-time)
- [ ] Create Google Play Console listing
- [ ] Upload app icon (512x512px)
- [ ] Add feature graphic (1024x500px)
- [ ] Add app screenshots (see requirements below)
- [ ] Write app description (use APP_STORE_LISTING.md)
- [ ] Add keywords
- [ ] Set pricing/subscription info
- [ ] Add privacy policy URL
- [ ] Add support email
- [ ] Configure in-app billing
- [ ] Create demo account for reviewers
- [ ] Complete content rating questionnaire
- [ ] Submit for review

---

## 🟡 IMPORTANT (Should Complete Before Launch)

### Testing on Physical Devices

**iOS Testing:**
- [ ] Test on iPhone (latest iOS)
- [ ] Test on older iPhone (iOS 13+)
- [ ] Test on iPad
- [ ] Test Face ID authentication
- [ ] Test session persistence (force quit and reopen)
- [ ] Test offline mode (airplane mode)
- [ ] Test all critical flows (see below)

**Android Testing:**
- [ ] Test on modern Android (Android 13+)
- [ ] Test on older Android (Android 8+)
- [ ] Test fingerprint authentication
- [ ] Test session persistence
- [ ] Test offline mode
- [ ] Test all critical flows

**Critical User Flow Testing:**
- [ ] Sign up → Email verification → Login
- [ ] Update profile information
- [ ] Add inventory items (manual)
- [ ] Import inventory (CSV)
- [ ] Export inventory (CSV)
- [ ] Create event
- [ ] Start sales session
- [ ] Add items to cart
- [ ] Apply discount
- [ ] Process payment (each method)
- [ ] End session
- [ ] View sales analytics
- [ ] Biometric auth on app resume
- [ ] Password reset flow
- [ ] Subscription purchase
- [ ] Subscription cancellation
- [ ] Account deletion

### App Store Assets

**App Icon:**
- [ ] **Design professional icon** (currently placeholder!)
- [ ] 1024x1024px PNG
- [ ] No transparency
- [ ] No rounded corners (added by OS)
- [ ] Represents inventory/sales/booth concept

**iOS Screenshots Required:**
- [ ] iPhone 6.7" (iPhone 14 Pro Max) - 3-10 screenshots
- [ ] iPhone 6.5" (iPhone 11 Pro Max) - 3-10 screenshots
- [ ] iPad 12.9" (iPad Pro) - 3-10 screenshots

**Android Screenshots Required:**
- [ ] Phone screenshots - 2-8 screenshots (min 320px, max 3840px)
- [ ] 7" tablet screenshots (optional)
- [ ] 10" tablet screenshots (optional)
- [ ] Feature graphic: 1024x500px

**Screenshot Ideas:**
1. Inventory list with product photos
2. Add/edit product screen
3. Point-of-sale checkout with cart
4. Sales analytics dashboard
5. Event management screen
6. Session tracking view
7. Payment method selection
8. Biometric authentication prompt

### Supabase Configuration
- [ ] Verify all tables have proper RLS policies
- [ ] Test with different user roles
- [ ] Verify Edge Functions are deployed
- [ ] Set Edge Function secrets:
  - [ ] STRIPE_SECRET_KEY (test initially, then live)
  - [ ] STRIPE_WEBHOOK_SECRET
  - [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] Configure Stripe webhook in Stripe Dashboard
- [ ] Test webhook delivery

### Firebase Setup
- [ ] Verify Firebase Crashlytics is configured
- [ ] Test crash reporting
- [ ] Set up error alerts
- [ ] Verify google-services.json (Android)
- [ ] Verify GoogleService-Info.plist (iOS)

---

## 🟢 NICE TO HAVE (Can Do After Launch)

### Marketing Preparation
- [ ] Create Twitter/X account (@BoothBrainApp)
- [ ] Create Instagram account
- [ ] Create Facebook page
- [ ] Create landing page with email signup
- [ ] Prepare launch announcement
- [ ] Contact vendor communities/influencers
- [ ] Create demo video
- [ ] Write blog post about features

### Documentation
- [ ] User guide / help documentation
- [ ] Video tutorials
- [ ] FAQ page expansion
- [ ] Vendor success stories

### Beta Testing
- [ ] TestFlight beta (iOS) - 10-100 testers
- [ ] Internal testing track (Android)
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Update based on feedback

### Analytics & Monitoring
- [ ] Set up analytics tracking
- [ ] Configure error monitoring alerts
- [ ] Create dashboard for key metrics
- [ ] Set up app performance monitoring

### Legal (if operating as business)
- [ ] Register business entity
- [ ] Get business license
- [ ] Set up business bank account
- [ ] Get liability insurance (optional)
- [ ] Consult lawyer for T&C review (recommended)

---

## 📱 Build & Deploy Steps

### Development Build (For Testing)
```bash
# Build for iOS
eas build --platform ios --profile preview

# Build for Android
eas build --platform android --profile preview

# Install on device via QR code or download link
```

### Production Build (For App Store Submission)

**Pre-build Checklist:**
- [ ] Increment version number in app.config.ts
- [ ] Update EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to pk_live_... in eas.json
- [ ] Update Stripe secrets in Supabase to live keys
- [ ] Test one final time with test keys
- [ ] Verify all URLs work (privacy, terms, support)

**Build Commands:**
```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Build for Google Play
eas build --platform android --profile production

# Build both
eas build --platform all --profile production
```

**Post-build:**
- [ ] Download .ipa (iOS) and .aab (Android) files
- [ ] Test builds on physical devices
- [ ] Upload to App Store Connect (iOS)
- [ ] Upload to Google Play Console (Android)
- [ ] Submit for review

---

## 📋 Submission Checklist

### App Review Information

**Demo Account:**
- Email: demo@boothbrain.app
- Password: [create secure password]
- Pre-populate with:
  - [ ] 10-20 sample inventory items with photos
  - [ ] 2-3 sample events
  - [ ] 1 active session with sales data
  - [ ] Various payment methods configured

**Review Notes:**
```
BoothBrain is an inventory and sales tracking app for vendors who sell at markets, fairs, and events.

TEST ACCOUNT:
Email: demo@boothbrain.app
Password: [password]

HOW TO TEST:
1. Login with credentials above
2. View Inventory tab to see sample products
3. Tap Events tab → Select an event → "Start Session"
4. Go to Sale tab → Add items to cart → Complete checkout
5. View Analytics to see sales reports
6. Biometric authentication triggers when app resumes from background

PAYMENTS:
The app supports multiple payment methods. Use test Stripe keys in development.

CONTACT:
song.sopaul@gmail.com for questions
```

### Age Rating / Content Rating

**Apple App Store:**
- Age Rating: 4+ (No objectionable content)
- Unrestricted Web Access: No
- Gambling: No
- Contests: No
- Medical/Health: No

**Google Play:**
- Content Rating: Everyone
- Target Age: Adults
- Ads: No (unless you add them)
- In-app Purchases: Yes (subscription)

### Export Compliance
- [ ] Does your app use encryption? → No (or standard only)
- [ ] Uses HTTPS/SSL only (standard encryption)
- [ ] No custom encryption implementation

---

## 🚨 Common Rejection Reasons & Prevention

### Apple App Store

**Rejection: "Privacy policy URL doesn't work"**
- ✅ Fix: Verify https://boothbrain.app/privacy is publicly accessible

**Rejection: "App crashes on launch"**
- ✅ Fix: Test on physical devices, check iOS version compatibility

**Rejection: "Missing functionality"**
- ✅ Fix: Ensure all features in screenshots are accessible

**Rejection: "In-app purchase not working"**
- ✅ Fix: Configure StoreKit, provide test account

**Rejection: "Misleading screenshots"**
- ✅ Fix: Use actual app screenshots, no mockups

### Google Play

**Rejection: "Content rating incomplete"**
- ✅ Fix: Complete content rating questionnaire

**Rejection: "Privacy policy missing"**
- ✅ Fix: Add privacy policy URL in Play Console

**Rejection: "Permissions not justified"**
- ✅ Fix: Explain why each permission is needed

---

## ✅ Final Pre-Submission Checklist

**Last Minute Verification:**
- [ ] App launches successfully
- [ ] No console errors or warnings
- [ ] All links work (privacy, terms, support)
- [ ] Email addresses receive mail
- [ ] Demo account works
- [ ] Screenshots match current app version
- [ ] Version number is correct
- [ ] Using LIVE Stripe keys (not test)
- [ ] Supabase Edge Functions have live keys
- [ ] App Store/Play Store listing is complete
- [ ] Deep breath - you've got this! 🚀

---

## 📞 Support Contacts

**Expo/EAS:**
- Docs: https://docs.expo.dev
- Forums: https://forums.expo.dev

**Apple Developer:**
- Support: https://developer.apple.com/support
- Phone: 1-800-633-2152

**Google Play:**
- Support: https://support.google.com/googleplay/android-developer

**Stripe:**
- Dashboard: https://dashboard.stripe.com
- Support: https://support.stripe.com

---

## 📊 Post-Launch Monitoring

**First 24 Hours:**
- [ ] Monitor crash reports (Firebase)
- [ ] Check support email every 2-4 hours
- [ ] Respond to app store reviews
- [ ] Monitor server performance (Supabase)
- [ ] Watch for spike in errors

**First Week:**
- [ ] Daily review of analytics
- [ ] Address critical bugs immediately
- [ ] Respond to all reviews
- [ ] Collect user feedback
- [ ] Plan first update

**First Month:**
- [ ] Analyze usage patterns
- [ ] Identify most-used features
- [ ] Identify pain points
- [ ] Plan feature roadmap
- [ ] Consider marketing push

---

**Good luck with your launch! 🎉**

For questions: [your-email]
