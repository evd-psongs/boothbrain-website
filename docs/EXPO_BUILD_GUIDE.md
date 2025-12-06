# Expo Development & Build Guide

**Last Updated:** 2025-12-06
**Status:** 🟢 Active - Detailed reference
**Purpose:** Comprehensive EAS build instructions and troubleshooting

Quick reference for running development builds and creating production builds.

---

## 🚀 Quick Start (npm Scripts)

We've added convenient npm scripts to make building easier. Use these instead of typing long EAS commands!

### **Most Common Commands**

```bash
# Build production iOS and run quality checks first
npm run ship:ios

# Build production iOS for TestFlight
npm run build:prod:ios

# Submit existing build to TestFlight
npm run submit:ios

# Run TypeScript + ESLint checks
npm run build:check

# List recent builds
npm run build:list
```

### **All Available Scripts**

**Preview Builds (Internal Testing):**
```bash
npm run build:preview:ios       # iOS preview build (QR code install)
npm run build:preview:android   # Android preview build
npm run build:preview:all       # Both platforms
```

**Production Builds (App Store/TestFlight):**
```bash
npm run build:prod:ios          # iOS for TestFlight/App Store
npm run build:prod:android      # Android for Google Play
npm run build:prod:all          # Both platforms
```

**Submission:**
```bash
npm run submit:ios              # Submit to TestFlight/App Store
npm run submit:android          # Submit to Google Play
npm run build:submit:ios        # Build + submit (combined)
```

**Utilities:**
```bash
npm run build:check             # Run TypeScript + ESLint
npm run build:list              # List recent builds
npm run ship:ios                # Check + build production iOS
```

---

## 🚀 Running Development Build (Expo Dev Client)

### Option 1: Using Existing Dev Build

If you already have a development build installed on your device:

```bash
# Start the development server
npx expo start --dev-client

# Or with tunnel for remote testing
npx expo start --dev-client --tunnel

# Or clear cache if having issues
npx expo start --dev-client --clear
```

**Then on your device:**
- Open the development build app (looks like Expo Go but with your app icon)
- Scan the QR code or enter the URL
- App will load with hot reload enabled

### Option 2: Create New Development Build

If you don't have a dev build installed or need to update it:

```bash
# Build for iOS
eas build --profile development --platform ios

# Build for Android
eas build --profile development --platform android

# Build for both
eas build --profile development --platform all
```

**After build completes:**
1. Download the build to your device (scan QR or download link)
2. Install the .ipa (iOS) or .apk (Android)
3. Run `npx expo start --dev-client`
4. Open the installed dev build app

---

## 📱 EAS Build Commands

### Development Build (Internal Testing)
```bash
# iOS development build
eas build --profile development --platform ios

# Android development build
eas build --profile development --platform android

# Both platforms
eas build --profile development --platform all
```

**Use for:** Testing with native modules, biometrics, Firebase, etc.

---

### Preview Build (Internal Distribution)
```bash
# iOS preview (TestFlight or direct install)
eas build --profile preview --platform ios

# Android preview (Internal testing track)
eas build --profile preview --platform android

# Both platforms
eas build --profile preview --platform all
```

**Use for:** Beta testing, showing to stakeholders

---

### Production Build (App Store Submission)
```bash
# iOS production (App Store)
eas build --profile production --platform ios

# Android production (Google Play)
eas build --profile production --platform android

# Both platforms
eas build --profile production --platform all
```

**Use for:** Final submission to App Store / Google Play

---

## 🔧 Common Build Options

### Auto-submit to Store
```bash
# Build and auto-submit to App Store
eas build --profile production --platform ios --auto-submit

# Build and auto-submit to Google Play
eas build --profile production --platform android --auto-submit
```

### Non-interactive Mode
```bash
# Skip prompts (use configured values)
eas build --profile production --platform ios --non-interactive
```

### Local Build (Faster, No Cloud)
```bash
# Build locally instead of on EAS servers
eas build --profile development --platform ios --local
```

---

## 📋 Your Build Profiles (from eas.json)

### Development Profile
```json
{
  "developmentClient": true,
  "distribution": "internal"
}
```
- For development/testing with dev client
- Includes developer tools
- Can connect to Metro bundler

### Preview Profile
```json
{
  "distribution": "internal",
  "env": {
    // Uses test Stripe keys
  }
}
```
- For internal testing (TestFlight, Internal testing)
- Production-like but with test services
- Can share with beta testers

### Production Profile
```json
{
  "distribution": "store",
  "autoIncrement": true,
  "env": {
    // Should use LIVE Stripe keys
  }
}
```
- For App Store / Google Play submission
- Version auto-increments
- Production configuration

---

## 🔍 Check Build Status

### View Recent Builds
```bash
# List all builds
eas build:list

# List builds for specific platform
eas build:list --platform ios

# List only production builds
eas build:list --profile production
```

### View Specific Build
```bash
# View build details
eas build:view [BUILD_ID]

# Cancel a running build
eas build:cancel [BUILD_ID]
```

---

## 📱 Install Builds on Device

### iOS (.ipa)

**Option 1: TestFlight (Recommended for iOS)**
```bash
# Submit to TestFlight
eas submit --platform ios

# Or auto-submit during build
eas build --profile preview --platform ios --auto-submit
```

**Option 2: Direct Install (Development Builds)**
- Build completes → Get download URL
- Open URL on iOS device
- Tap "Install" when prompted

**Option 3: Via Apple Configurator (Mac only)**
- Download .ipa file
- Connect device to Mac
- Use Apple Configurator 2 to install

### Android (.aab or .apk)

**Option 1: Google Play Internal Testing**
```bash
# Submit to Google Play
eas submit --platform android
```

**Option 2: Direct Install (.apk only)**
- Build completes → Download .apk
- Transfer to device or use download link
- Enable "Install from unknown sources"
- Tap .apk to install

---

## 🐛 Troubleshooting

### "Metro bundler not running"
```bash
# Clear cache and restart
npx expo start --dev-client --clear

# Or reset Metro bundler
watchman watch-del-all  # If you have watchman
rm -rf node_modules
npm install
```

### "Build failed" or "EAS CLI out of date"
```bash
# Update EAS CLI
npm install -g eas-cli

# Login again
eas login

# Check account
eas whoami
```

### "No development build found on device"
```bash
# Create a new development build
eas build --profile development --platform ios

# Make sure you're using --dev-client flag
npx expo start --dev-client
```

### "Certificate/Provisioning profile issues" (iOS)
```bash
# Let EAS manage credentials automatically
eas build --profile development --platform ios

# Or manually manage credentials
eas credentials
```

---

## 📖 Quick Reference

### Start Development
```bash
# If you have dev build installed
npx expo start --dev-client

# If you need to create dev build first
eas build --profile development --platform ios
# (wait for build, install on device)
npx expo start --dev-client
```

### Test on Device
```bash
# Build preview version
eas build --profile preview --platform ios

# After build, install via QR/link
```

### Submit to Stores
```bash
# 1. Build production
eas build --profile production --platform all

# 2. Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 🎯 For Your Current App

### Quick Start (Development)
```bash
# Start dev server (if dev build already installed)
cd /mnt/c/Users/songs/BoothBrain
npx expo start --dev-client

# Or with tunnel mode
npx expo start --dev-client --tunnel
```

### Create Preview Build (For Testing)
```bash
# Build for testing on device
eas build --profile preview --platform ios

# Wait for build, then install via QR code
```

### Production Build (For App Store)
```bash
# Make sure live Stripe keys are set in eas.json first!
eas build --profile production --platform ios
```

---

## 📚 Helpful Commands

```bash
# Check EAS account
eas whoami

# View project configuration
eas config

# View credentials (iOS certificates, etc.)
eas credentials

# Open build logs
eas build:view [BUILD_ID]

# List devices registered for development
eas device:list

# Register new device for development
eas device:create
```

---

**Need more help?**
- Expo Docs: https://docs.expo.dev/build/introduction/
- EAS CLI Docs: https://docs.expo.dev/build/eas-json/
