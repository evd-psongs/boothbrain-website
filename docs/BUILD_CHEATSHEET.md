# BoothBrain Build & Ship Cheatsheet

**Last Updated:** 2025-12-06
**Status:** 🟢 Active - Quick reference
**Purpose:** All build commands and deployment workflows

Quick reference for building and deploying BoothBrain to TestFlight and App Store.

---

## 🚀 Quick Commands

### Most Common Workflows

```bash
# 1️⃣ TEST BUILD (with Crashlytics test button)
npm run build:preview:ios

# 2️⃣ FINAL APP STORE BUILD (production-ready)
npm run ship:ios

# 3️⃣ SUBMIT TO TESTFLIGHT (after build completes)
npm run submit:ios
```

---

## 📋 Complete Command Reference

### Pre-Build Checks

```bash
# Run before ANY build to catch errors early
npm run build:check

# What it does:
# - TypeScript type checking
# - ESLint code quality checks
```

### iOS Builds

```bash
# Preview build (internal testing with dev tools)
npm run build:preview:ios

# Production build (App Store submission)
npm run build:prod:ios

# Production build + auto-run checks first
npm run ship:ios
```

### Android Builds

```bash
# Preview build (internal testing)
npm run build:preview:android

# Production build (Google Play)
npm run build:prod:android
```

### Both Platforms

```bash
# Build iOS + Android preview
npm run build:preview:all

# Build iOS + Android production
npm run build:prod:all
```

### Submission

```bash
# Submit iOS to TestFlight/App Store
npm run submit:ios

# Submit Android to Google Play
npm run submit:android

# Build production iOS + submit (all-in-one)
npm run build:submit:ios
```

### Utilities

```bash
# List recent builds
npm run build:list

# Start dev server
npm start

# Start dev server with cache cleared
npm start -- --clear
```

---

## 🎯 When to Use Which Build

### Use **Preview** (`npm run build:preview:ios`) When:

- ✅ Testing new features
- ✅ Testing Crashlytics (has test button)
- ✅ Testing Apple IAP in sandbox
- ✅ Sharing with beta testers via TestFlight
- ✅ Want to verify everything works before final release

**Includes:**
- ✅ Developer Tools section (Crashlytics test button)
- ✅ All production features (IAP, Firebase, etc.)
- ✅ Can submit to TestFlight
- ✅ Can submit to App Store (but keep for testing only!)

### Use **Production** (`npm run ship:ios`) When:

- ✅ Ready for App Store submission
- ✅ All testing complete
- ✅ Final release build
- ✅ Want clean build without dev tools

**Includes:**
- ❌ No Developer Tools section
- ✅ All production features
- ✅ Can submit to TestFlight
- ✅ Can submit to App Store
- ✅ Auto-increments build number

---

## 📱 Complete Testing Workflow

### Phase 1: Preview Testing (1-2 days)

```bash
# 1. Build preview
npm run build:preview:ios

# 2. When EAS asks: "Submit to App Store Connect? (Y/n)"
Y  # Press Y to auto-submit to TestFlight

# 3. Wait for TestFlight email (5-15 min)

# 4. Install via TestFlight on physical device

# 5. Test everything:
# - Go to Settings → Developer Tools → Test Crashlytics
# - Check Firebase Console for crash report
# - Test IAP sandbox purchases
# - Test all major features
```

### Phase 2: Production Release (When ready)

```bash
# 1. Build production
npm run ship:ios

# 2. Submit to TestFlight
npm run submit:ios

# 3. Final smoke test in TestFlight

# 4. Submit to App Store via App Store Connect dashboard
```

---

## 🔍 Build Profile Comparison

| Feature | Preview | Production |
|---------|---------|------------|
| **Distribution** | App Store | App Store |
| **TestFlight** | ✅ YES | ✅ YES |
| **App Store** | ✅ YES* | ✅ YES |
| **Dev Tools** | ✅ YES | ❌ NO |
| **Crashlytics Test Button** | ✅ YES | ❌ NO |
| **Firebase Crashlytics** | ✅ YES | ✅ YES |
| **RevenueCat IAP** | ✅ YES | ✅ YES |
| **Sandbox IAP** | ✅ YES | ✅ YES |
| **Auto Build Number** | ❌ NO | ✅ YES |
| **Use Case** | Testing | Release |

\* Preview CAN go to App Store but should be used for beta testing only!

---

## ⏱️ Build Time Expectations

- **EAS Build:** 15-20 minutes
- **TestFlight Processing:** 5-15 minutes
- **App Store Review:** 1-3 days
- **Total Time (preview to TestFlight):** ~30 minutes
- **Total Time (production to App Store):** 1-3 days

---

## 🐛 Troubleshooting

### Build Fails

```bash
# 1. Check for errors first
npm run build:check

# 2. Clear cache and rebuild
npm run build:preview:ios
```

### Can't Submit to TestFlight

```bash
# Check build list and status
npm run build:list

# Manually submit specific build
eas submit --platform ios
```

### Developer Tools Not Showing

**In Preview Builds:**
- ✅ Should show automatically (EXPO_PUBLIC_ENABLE_DEV_TOOLS=true)
- If missing, rebuild: `npm run build:preview:ios`

**In Production Builds:**
- ❌ Intentionally hidden (this is correct!)

### Crashlytics Not Recording

1. Make sure you're in EAS build (not Expo Go)
2. Check Firebase Console → Crashlytics
3. Wait 5-10 minutes after crash
4. Reopen app (sometimes triggers upload)

---

## 🔐 Environment Variables by Profile

### Preview Profile

```bash
EXPO_PUBLIC_ENABLE_DEV_TOOLS=true        # ✅ Dev Tools visible
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Test Stripe key
REVENUECAT_PUBLIC_API_KEY_IOS=appl_...   # RevenueCat iOS key
EXPO_PUBLIC_SUPABASE_URL=...             # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=...        # Supabase anon key
```

### Production Profile

```bash
# Same as preview BUT:
# EXPO_PUBLIC_ENABLE_DEV_TOOLS is NOT set  # ❌ Dev Tools hidden
```

---

## 📝 Pre-Flight Checklist

### Before Building Preview

- [ ] Code committed to git
- [ ] `npm run build:check` passes
- [ ] All features tested in Expo Go (where possible)

### Before Building Production

- [ ] All preview testing complete
- [ ] Crashlytics verified working
- [ ] IAP sandbox purchases tested
- [ ] No blocking bugs
- [ ] Version number updated (if needed)
- [ ] CLAUDE.md updated with changes

### Before App Store Submission

- [ ] Production build tested in TestFlight
- [ ] All critical user flows tested
- [ ] Screenshots updated (if UI changed)
- [ ] App Store description updated (if needed)
- [ ] Privacy policy current
- [ ] Terms of service current

---

## 🎓 Pro Tips

1. **Always test preview first** before production build
2. **Use TestFlight for all testing** (not just final builds)
3. **Check Firebase Console** after test crashes (~5 min delay)
4. **Keep preview builds** for regression testing
5. **Never skip `build:check`** - catches errors early
6. **Use `build:list`** to track build history
7. **Submit during build** - press Y when EAS asks
8. **Test on physical device** - simulators don't support IAP or full Firebase

---

## 📞 Quick Help

**Build stuck?**
```bash
npm run build:list  # Check status
```

**Need to rebuild?**
```bash
npm run build:preview:ios  # Just run again
```

**Forgot which commands?**
```bash
npm run  # Lists all available commands
```

**Check recent builds?**
```bash
npm run build:list
```

---

## 🚦 Decision Tree

```
Need to test Crashlytics or IAP?
  ├─ YES → npm run build:preview:ios
  └─ NO → Ready for App Store?
           ├─ YES → npm run ship:ios
           └─ NO → Keep developing with Expo Go
```

---

**Last Updated:** 2024-12-05
**Version:** 1.0.0

---

## Quick Copy-Paste Workflows

### Workflow 1: "I want to test my changes"

```bash
npm run build:check && npm run build:preview:ios
# When asked to submit: Y
# Wait ~30 min total
# Install via TestFlight
# Test everything
```

### Workflow 2: "I'm ready to ship to App Store"

```bash
npm run ship:ios
# When asked to submit: Y
# Wait for TestFlight
# Final smoke test
# Submit via App Store Connect
```

### Workflow 3: "I just want to check if code is clean"

```bash
npm run build:check
```

That's it! 🎉
