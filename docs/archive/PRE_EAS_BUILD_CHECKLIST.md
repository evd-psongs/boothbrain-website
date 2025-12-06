# Pre-EAS Build Checklist

**Last Updated:** 2025-12-04
**Purpose:** Ensure everything is ready before creating EAS build for Apple IAP sandbox testing

---

## ✅ Quick Pre-Flight Check (5 minutes)

Run these commands to verify everything is ready:

```bash
# 1. Verify TypeScript compilation
npm run typecheck

# 2. Verify ESLint passes
npm run lint

# 3. Check git status (should be clean on master)
git status

# 4. Verify eas.json has RevenueCat key
grep "REVENUECAT" eas.json
```

**Expected Results:**
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ Git: On branch master, nothing to commit
- ✅ eas.json: Shows REVENUECAT_PUBLIC_API_KEY_IOS

---

## 📋 Detailed Checklist

### 1. Code Quality ✅

- [x] **TypeScript compilation passes**
  ```bash
  npm run typecheck
  ```
  Expected: No errors

- [x] **ESLint passes**
  ```bash
  npm run lint
  ```
  Expected: No errors

- [x] **All tests pass** (if you have tests)
  ```bash
  npm test
  ```
  Expected: All tests green

---

### 2. Environment Configuration ✅

- [x] **RevenueCat API key in .env**
  ```bash
  grep "REVENUECAT_PUBLIC_API_KEY_IOS" .env
  ```
  Expected: `REVENUECAT_PUBLIC_API_KEY_IOS=appl_QqZTDbwkjAfMybBUxpeLuKUKjKi`

- [x] **RevenueCat API key in eas.json (preview)**
  ```bash
  grep -A 10 '"preview"' eas.json | grep REVENUECAT
  ```
  Expected: Shows the RevenueCat key

- [x] **RevenueCat API key in eas.json (production)**
  ```bash
  grep -A 10 '"production"' eas.json | grep REVENUECAT
  ```
  Expected: Shows the RevenueCat key

- [x] **Supabase keys configured**
  ```bash
  grep "EXPO_PUBLIC_SUPABASE" eas.json
  ```
  Expected: URL and ANON_KEY present

---

### 3. Apple IAP Setup ✅

- [x] **App Store Connect subscription created**
  - Product ID: `boothbrain_pro_quarterly`
  - Price: $29.99 / 3 months
  - Status: Ready for Sale (or In Review)

- [x] **RevenueCat project configured**
  - iOS app added with Bundle ID: `com.boothbrain.app`
  - Product linked to entitlement: "BoothBrain Pro"
  - API keys obtained

- [x] **Database migration applied**
  ```bash
  ls -la supabase/migrations/20251204_add_apple_iap_fields.sql
  ```
  Expected: File exists

- [x] **Code fixes applied**
  - Memory leak fix ✅
  - Transaction ID uniqueness ✅
  - Error recovery ✅
  - Plan caching ✅
  - Status mapper ✅

---

### 4. Git & Version Control ✅

- [x] **All changes committed**
  ```bash
  git status
  ```
  Expected: `nothing to commit, working tree clean`

- [x] **On correct branch**
  ```bash
  git branch
  ```
  Expected: `* master` (or `* test-branch` if testing there first)

- [x] **Branches in sync**
  ```bash
  git log master..test-branch --oneline
  git log test-branch..master --oneline
  ```
  Expected: No differences

- [x] **Recent commits include:**
  - Apple IAP fixes (5 fixes)
  - 2FA recovery codes fix
  - RevenueCat key in eas.json

---

### 5. Dependencies ✅

- [x] **react-native-purchases installed**
  ```bash
  npm list react-native-purchases
  ```
  Expected: Shows version

- [x] **expo-crypto installed**
  ```bash
  npm list expo-crypto
  ```
  Expected: Shows version

- [x] **No peer dependency warnings**
  ```bash
  npm install
  ```
  Expected: No errors (warnings OK)

---

### 6. App Configuration ✅

- [x] **Bundle ID matches App Store Connect**
  ```bash
  grep "bundleIdentifier" app.config.ts
  ```
  Expected: `bundleIdentifier: 'com.boothbrain.app'`

- [x] **Version number appropriate**
  ```bash
  grep "version:" app.config.ts
  ```
  Expected: `version: '1.0.0'` (or higher)

- [x] **iOS deployment target correct**
  ```bash
  grep "deploymentTarget" app.config.ts
  ```
  Expected: `deploymentTarget: '15.1'`

- [x] **Firebase config files present**
  ```bash
  ls -la GoogleService-Info.plist google-services.json
  ```
  Expected: Both files exist

---

### 7. Testing Verification ✅

- [x] **Expo Go testing passed**
  - App launches without crashes
  - Modal opens and shows expected error
  - 2FA recovery codes work
  - Sign in/out cycle works

- [x] **No critical bugs reported**
  - No TypeScript errors
  - No runtime crashes
  - All existing features work

---

### 8. Documentation ✅

- [x] **Implementation plan reviewed**
  ```bash
  ls -la docs/APPLE_IAP_IMPLEMENTATION_PLAN.md
  ```
  Expected: File exists (1,950 lines)

- [x] **Testing checklist available**
  ```bash
  ls -la docs/APPLE_IAP_TESTING_CHECKLIST.md
  ```
  Expected: File exists

- [x] **Fixes documented**
  ```bash
  ls -la docs/APPLE_IAP_FIXES_APPLIED.md
  ```
  Expected: File exists

---

### 9. EAS CLI Ready ✅

- [x] **EAS CLI installed**
  ```bash
  eas --version
  ```
  Expected: Version 16.0.0 or higher

- [x] **Logged into EAS**
  ```bash
  eas whoami
  ```
  Expected: Shows your Expo username

- [x] **Project configured**
  ```bash
  grep "projectId" app.config.ts
  ```
  Expected: Shows EAS project ID

---

### 10. Apple Developer Account ✅

- [x] **Certificates valid**
  - Check: https://developer.apple.com/account/resources/certificates/list
  - Expected: Valid iOS Distribution certificate

- [x] **Provisioning profiles valid**
  - Check: https://developer.apple.com/account/resources/profiles/list
  - Expected: Valid App Store profile for `com.boothbrain.app`

- [x] **App Store Connect access**
  - Check: https://appstoreconnect.apple.com
  - Expected: Can access BoothBrain app

---

## 🚨 Critical Items (MUST BE CHECKED)

Before running `eas build`, these MUST be true:

### 🔴 **BLOCKER:** RevenueCat Key in eas.json
- [x] REVENUECAT_PUBLIC_API_KEY_IOS in preview profile
- [x] REVENUECAT_PUBLIC_API_KEY_IOS in production profile

**Why Critical:** Without this, RevenueCat will fail to initialize in the build, and you won't be able to test IAP at all.

### 🔴 **BLOCKER:** Bundle ID Matches
- [x] app.config.ts: `com.boothbrain.app`
- [x] App Store Connect: `com.boothbrain.app`
- [x] RevenueCat: `com.boothbrain.app`

**Why Critical:** Mismatched bundle IDs will prevent App Store Connect product lookup.

### 🔴 **BLOCKER:** Code Quality
- [x] TypeScript: 0 errors
- [x] ESLint: 0 errors
- [x] No uncommitted changes

**Why Critical:** Build errors waste time (15-20 min per build).

---

## ⚠️ Optional But Recommended

### Nice to Have (But Not Required):

- [ ] **Update CLAUDE.md** with current session notes
  - Document pre-build checks
  - Note any last-minute changes

- [ ] **Create git tag for this milestone**
  ```bash
  git tag -a pre-iap-build -m "Ready for Apple IAP sandbox testing"
  git push --tags  # if you have remote
  ```

- [ ] **Screenshot current Settings screen**
  - Useful for comparison after build

---

## 🎯 Final Verification Command

Run this single command to verify everything:

```bash
npm run typecheck && \
npm run lint && \
echo "✅ Code quality passed" && \
grep "REVENUECAT_PUBLIC_API_KEY_IOS" eas.json > /dev/null && \
echo "✅ RevenueCat key found in eas.json" && \
git status | grep "nothing to commit" > /dev/null && \
echo "✅ Git working tree clean" && \
echo "" && \
echo "🚀 READY TO BUILD!" || \
echo "❌ Pre-build checks failed - review above"
```

**Expected Output:**
```
✅ Code quality passed
✅ RevenueCat key found in eas.json
✅ Git working tree clean

🚀 READY TO BUILD!
```

---

## 📱 Build Command

Once all checks pass, create the build:

```bash
# Preview build (for sandbox testing)
eas build --profile preview --platform ios

# Or use the npm script
npm run build:preview:ios
```

**Expected:**
- Build queues successfully
- Takes ~15-20 minutes
- Returns QR code to install on device

---

## 🐛 Troubleshooting

### Issue: "Missing environment variable REVENUECAT_PUBLIC_API_KEY_IOS"
**Fix:**
```bash
# Add to eas.json preview.env and production.env
"REVENUECAT_PUBLIC_API_KEY_IOS": "appl_QqZTDbwkjAfMybBUxpeLuKUKjKi"
```

### Issue: "Could not find provisioning profile"
**Fix:**
```bash
# Let EAS auto-manage
eas build --profile preview --platform ios --auto-submit
```

### Issue: TypeScript errors about RevenueCat types
**Fix:**
```bash
# Types should auto-install, but if needed:
npm install @types/react-native-purchases --save-dev
```

### Issue: Build fails with "Pod install failed"
**Fix:** Already handled with `EAS_POD_INSTALL_ARGS: "--repo-update"` in eas.json

---

## ✅ Summary

**All Green?** You're ready to build!

**Any Red?** Fix the issues above before building to save time.

**Build Time:** ~15-20 minutes
**Next Step:** Phase 7 Sandbox Testing
**Documentation:** `docs/APPLE_IAP_IMPLEMENTATION_PLAN.md` (lines 1240-1680)

---

**Good luck with the build!** 🚀
