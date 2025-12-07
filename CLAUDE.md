# CLAUDE.md - BoothBrain Development Guide

**Last Updated:** 2025-12-07

## Project Overview
BoothBrain is an Expo React Native app for managing vendor booth inventory and sales.

## Documentation 📚
**Quick Start:** See `/docs/INDEX.md` for complete documentation catalog

**Key Documents:**
- `/docs/BUILD_CHEATSHEET.md` - All build commands and workflows
- `/docs/FINAL_CHECKLIST.md` - Complete App Store submission guide
- `/docs/REVENUECAT_WEBHOOK_DEPLOYMENT.md` - Webhook deployment (next step)
- `/docs/PRIVACY_POLICY.md`, `/docs/TERMS_OF_SERVICE.md` - Legal docs
- `/docs/archive/SESSION_HISTORY.md` - Detailed session logs archive

**Maintenance:**
- Run `/doc-audit` to check documentation health
- Update `docs/INDEX.md` when adding/removing docs
- Add headers to new docs: `**Last Updated**, **Status**, **Purpose**`

---

## Development Environment

### Windows + WSL Setup (IMPORTANT!)
⚠️ **ALWAYS run `npm install` and `npm start` from Windows PowerShell, NOT from WSL**

**If you get `'expo' is not recognized` error:**
1. Open Windows PowerShell (not WSL)
2. `Remove-Item -Recurse -Force node_modules`
3. `npm cache clean --force`
4. `npm install`
5. `npm start`

**Notes:**
- Code editing and git operations: Either WSL or Windows
- Metro Bundler: Must run from Windows for Expo Go

---

## Git Workflow

**Branches:**
- `master` - Production/stable code
- `test-branch` - Development/testing

**Current Status:**
- Both branches at commit `52c8bc0` (2025-12-07 RevenueCat fixes)
- Branches in sync
- 13 commits ahead of origin/master
- Active development on both branches (synchronized)

**Quick Commands:**
```bash
git branch                  # Check current branch
git checkout test-branch   # Switch to dev branch
git checkout master        # Switch to production
npm start -- --clear       # Clear Metro cache if needed
```

---

## Current Session (2025-12-07 - RevenueCat Subscription Fix Marathon)

### What Was Accomplished:
- ✅ **Environment Variable Fix:** Changed to `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` in eas.json
- ✅ **Entitlement Identifier:** Updated from `'pro'` to `'BoothBrain Pro'` to match RevenueCat dashboard
- ✅ **Debug Logging:** Added comprehensive logging to RevenueCat initialization and subscription modal
- ✅ **Initialization Guards:** Added proper checks to prevent SDK calls before initialization
- ✅ **App Store Connect:** Configured subscription product, pricing, localization, and availability
- ✅ **Agreements & Banking:** Completed Paid Apps Agreement and banking setup (required for sandbox testing)

### Key Commits (2025-12-07):
- `52c8bc0` - Fix: Update entitlement identifier to match RevenueCat config
- `a6d719d` - Debug: Add comprehensive logging to RevenueCat initialization
- `37433ed` - Fix: Use EXPO_PUBLIC_ prefix for RevenueCat API key
- `98db456` - Fix: Check RevenueCat initialization before using SDK functions
- `2799d87` - Fix: RevenueCat initialization and timeout handling improvements

### Current Issue - Apple StoreKit Propagation Delay:

**Problem:** Subscription shows error "None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect"

**Root Cause:** For brand new apps that have never been submitted to App Store, Apple's StoreKit servers can take **up to 24 hours** to make subscriptions available, even in sandbox mode.

**What's Been Verified (All Correct):**
- ✅ Product ID: `boothbrain_pro_quarterly` (matches everywhere)
- ✅ Bundle ID: `com.boothbrain.app` (matches App Store Connect, RevenueCat, and code)
- ✅ Entitlement ID: `BoothBrain Pro` (matches RevenueCat dashboard)
- ✅ API Key: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` configured in eas.json
- ✅ Subscription created in App Store Connect with status "Ready to Submit"
- ✅ Subscription attached to app version
- ✅ Pricing configured ($29.99/quarter for 175 countries)
- ✅ Availability set (all regions)
- ✅ Localization complete (English U.S.)
- ✅ Review screenshot uploaded
- ✅ Paid Apps Agreement signed and active
- ✅ Banking information completed
- ✅ Testing with sandbox account (not personal Apple ID)
- ✅ RevenueCat offering configured with package

**EAS Build Status:** Build #13/15 used (saved 2 builds by not rebuilding unnecessarily)

### Next Steps:
1. **Wait 24 hours** for Apple StoreKit servers to propagate subscription
2. **Test again on 2025-12-07 afternoon/evening** with same TestFlight build
3. If still not working, consider StoreKit Configuration File for local testing
4. Once working, proceed with RevenueCat webhook deployment

### Testing Checklist for Tomorrow:
- [ ] Open TestFlight on iPhone
- [ ] Sign out of App Store (Settings → App Store → Sign Out)
- [ ] Open BoothBrain app
- [ ] Navigate to Settings → Subscription
- [ ] Click "View Plans" or "Upgrade to Pro"
- [ ] Should see quarterly subscription with $29.99 price
- [ ] Sign in with sandbox account when prompted
- [ ] Complete test purchase (free in sandbox)
- [ ] Verify Pro features unlock

### Important Notes:
- All code changes committed and ready
- No rebuild needed - current TestFlight build has all fixes
- Subscription will work once Apple's servers sync (standard 24hr delay for new apps)
- Alternative: StoreKit Configuration File can bypass wait for local testing

---

## Tech Stack

- **Framework:** Expo (React Native)
- **Database:** Supabase
- **Auth:** Supabase Auth + 2FA (TOTP)
- **Payments:** RevenueCat (Apple IAP) - iOS only currently
- **Styling:** NativeWind (Tailwind for RN)
- **State:** Zustand + React Query
- **Error Tracking:** Firebase Crashlytics
- **Navigation:** Expo Router

---

## Code Organization

### File Size Limits
- **Components:** Max 300 lines
- **Hooks:** Max 150 lines
- **Utils:** Max 100 lines per function
- **Providers:** State management only

### Folder Structure
```
src/
├── components/
│   ├── common/         # Reusable UI (buttons, inputs, banners)
│   ├── settings/       # Settings screen sections
│   ├── modals/         # Standalone modals
│   └── [screens]/      # Screen-specific components
├── hooks/              # Business logic hooks
├── lib/
│   ├── auth/           # Auth operations (profile, subscription, 2FA)
│   ├── purchases/      # RevenueCat service (Apple IAP)
│   ├── session/        # Session management (API, storage, device ID)
│   └── supabase.ts     # Supabase client
├── providers/          # Context providers (Auth, Session, Theme)
├── types/              # TypeScript type definitions
└── utils/              # Pure utility functions (dates, payment, async)
```

---

## Quality Gates

### Pre-Commit Checklist
Before committing ANY code changes:
- [ ] `npm run typecheck` - Zero TypeScript errors
- [ ] `npm run lint` - Zero ESLint errors
- [ ] No new `any` types (except error catches: `catch (err: any)`)
- [ ] No duplicate utility functions
- [ ] File sizes within limits
- [ ] All imports use `@/` alias

### Manual Testing Checklist
Test these critical flows after ANY change:
- [ ] **Auth:** Sign up → Login → Logout
- [ ] **Session:** Create session → Join session → End session
- [ ] **Inventory:** Add item → Edit item → Delete item → CSV export
- [ ] **Sales:** Add to cart → Apply discount → Checkout → Payment
- [ ] **Events:** Create event → Add task → Mark complete → Delete

---

## Critical Integration Points

### Database Schema Changes
When modifying Supabase tables:
1. Update `src/types/database.ts` types FIRST
2. Update corresponding `Row` types
3. Verify all API files using that table still compile
4. Test existing features using the modified table

### Provider Dependencies
These providers are interconnected - changes require extra care:
- **SupabaseAuthProvider** → **SessionProvider** (session depends on auth)
- **SessionProvider** → All screens (most screens use session context)
- **ThemeProvider** → All screens (styling depends on theme)

---

## Coding Standards

### Single Responsibility
```typescript
// ❌ BAD: Multiple responsibilities
export function SettingsScreen() {
  // Profile, password, payment, subscription, session management...
}

// ✅ GOOD: Single purpose
export function ProfileSection() {
  // Only profile updates
}
```

### Type Safety
```typescript
// ✅ DO: Use typed database interfaces
const sessionRow = data as SessionRow;

// ❌ DON'T: Use any
const sessionRow = data as any;

// ✅ DO: Use error helpers
catch (err) {
  const message = getErrorMessage(err);
}

// ❌ DON'T: Access error properties directly
catch (err: any) {
  const message = err.message;
}
```

### Utility Function Usage
```typescript
// ✅ DO: Import from centralized utilities
import { formatEventRange } from '@/utils/dates';
import { formatPaymentLabel } from '@/utils/payment';

// ❌ DON'T: Duplicate formatting logic
const formattedDate = `${start} - ${end}`; // formatEventRange already exists!
```

---

## Known Issues & Limitations

### Current Limitations:
- ⚠️ **Pro Subscriptions:** iOS only (Apple IAP via RevenueCat)
  - Android shows "Coming Soon" message
  - Google Play Billing planned for Phase 2
- ⚠️ **2FA in Expo Go:** Works in production builds only (TestFlight/App Store)
  - Session persistence issues in Expo Go
  - Test 2FA enrollment UI in Expo Go, full testing in EAS builds
- ⚠️ **Firebase Crashlytics:** Mocked in Expo Go, real in production builds
  - Crashlytics test button only visible in dev/preview builds

### Session Behavior:
- **Timeout:** 30 minutes of inactivity
- **Persistence:** Sessions survive app restarts (within 30 min window)
- **Code reuse:** Session codes expire after 30 minutes

### Recent Fixes (All Working):
- ✅ Session join function (join_session_secure alias added)
- ✅ RevenueCat initialization (now works on all session restore paths)
- ✅ Session approval flow (users properly wait for host approval)
- ✅ Toast positioning (centered, avoids Dynamic Island)
- ✅ 2FA modal UI (shield icon, cursor position)
- ✅ User deletion (CASCADE constraints enable clean deletion)

---

## Regression Prevention

### Breaking Changes - NEVER DO THIS:
- ❌ Change database column names without comprehensive type updates
- ❌ Modify context provider value shapes without updating all consumers
- ❌ Remove utility functions without checking all usages first
- ❌ Add `any` types to bypass TypeScript errors
- ❌ Skip loading states for async operations
- ❌ Remove error handling from existing code

### Safe Change Patterns:
- ✅ Add new database functions (don't modify existing)
- ✅ Add optional props to components (backward compatible)
- ✅ Add validation (doesn't break existing data)
- ✅ Fix bugs (makes things MORE reliable)
- ✅ Extract components (improves organization)

---

## Development Workflow

### Adding a New Feature:
1. **Plan:** Identify affected files and integration points
2. **Check:** Review existing utilities to reuse
3. **Implement:** Follow type safety and file size guidelines
4. **Verify:** Run `npm run typecheck` and `npm run lint`
5. **Test:** Complete manual testing checklist
6. **Update:** Update CLAUDE.md if architectural changes made
7. **Commit:** Use descriptive commit messages

### Build Commands:
```bash
# Type checking & linting
npm run typecheck
npm run lint

# Development
npm start                    # Start Metro bundler (Windows PowerShell!)
npm start -- --clear        # Clear cache

# Preview builds (TestFlight)
npm run build:preview:ios   # Build iOS preview
npm run submit:ios          # Submit to TestFlight

# Production builds (App Store)
npm run ship:ios            # Check + build production iOS
npm run build:prod:ios      # Build for App Store
npm run build:list          # List recent builds
```

See `/docs/BUILD_CHEATSHEET.md` for complete build command reference.

---

## Important Reminders

### TypeScript & Code Quality:
- ✅ **MAINTAINED:** Zero TypeScript errors (current achievement)
- ✅ **MAINTAINED:** Zero `any` types except error catches
- ✅ **MAINTAINED:** All files within size limits
- ✅ **MAINTAINED:** ESLint passing with zero errors

### Session Logs:
- 📝 Detailed session history moved to `/docs/archive/SESSION_HISTORY.md`
- 📝 Keep CLAUDE.md current session focused (this doc stays under 500 lines)
- 📝 Archive old sessions when adding new ones

### Before Each Session:
1. Read this file first
2. Check current branch: `git status`
3. Review recent commits: `git log --oneline | head -10`
4. Check for uncommitted changes
5. Run `npm run typecheck` to verify clean state

---

**For detailed session history, see:** `/docs/archive/SESSION_HISTORY.md`
**For build/deploy info, see:** `/docs/BUILD_CHEATSHEET.md`
**For documentation index, see:** `/docs/INDEX.md`
