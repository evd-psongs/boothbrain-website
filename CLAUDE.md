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
- Both branches at commit `6c2ce94` (2025-12-07 post-purchase fix attempt)
- Branches in sync
- 16 commits ahead of origin/master
- Active development on both branches (synchronized)

**Quick Commands:**
```bash
git branch                  # Check current branch
git checkout test-branch   # Switch to dev branch
git checkout master        # Switch to production
npm start -- --clear       # Clear Metro cache if needed
```

---

## Current Session (2025-12-07 - RevenueCat Subscription Integration)

### What Was Accomplished:
- ✅ **Subscription Integration Working:** Products load, purchases complete, Pro features unlock
- ✅ **Environment Variable Fix:** Changed to `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` in eas.json
- ✅ **Entitlement Identifier:** Updated from `'pro'` to `'BoothBrain Pro'` to match RevenueCat dashboard
- ✅ **Package Title Fix:** Modal now shows "Quarterly" instead of `$rc_three_month`
- ✅ **TestFlight Sandbox:** Discovered TestFlight auto-sandboxes purchases (no separate test accounts needed!)
- ✅ **App Store Connect:** Fully configured - subscription, pricing, agreements, banking all done

### Key Commits (2025-12-07):
- `6c2ce94` - Fix: Prevent post-purchase infinite loading hang (attempted fix - still broken)
- `6eb3ace` - Fix: Display 'Quarterly' instead of package identifier in subscription modal
- `52c8bc0` - Fix: Update entitlement identifier to match RevenueCat config
- `a6d719d` - Debug: Add comprehensive logging to RevenueCat initialization

### 🚨 CRITICAL BUG - Post-Purchase Infinite Loading

**Problem:** After successful purchase, app shows white screen with loading spinner indefinitely. User must delete and reinstall app from TestFlight to recover.

**What We Tried (commit `6c2ce94`):**
1. Removed `refreshSession()` from onSuccess callback - didn't help
2. Added `syncInProgressRef` flag to prevent concurrent syncs - didn't help
3. Added 10-second timeout to sync operations - didn't help

**Root Cause Analysis:**
The issue is likely deeper than just race conditions. After purchase:
1. Modal calls `syncSubscriptionToSupabase()`
2. Modal calls `onSuccess()` then `onClose()`
3. RevenueCat listener fires `addCustomerInfoUpdateListener`
4. Auth state change may trigger
5. Something in this flow causes `loading: true` to get stuck

**Files Involved:**
- `src/components/modals/SubscriptionModal.tsx` - handlePurchase() flow
- `src/providers/SupabaseAuthProvider.tsx` - onAuthStateChange listener, RevenueCat setup
- `app/(tabs)/settings.tsx` - onSuccess callback

**Possible Investigation Areas:**
1. The `loading` state in SupabaseAuthProvider - what's keeping it true?
2. The `buildAuthUser()` call after sync - is it hanging on DB query?
3. Modal state after onClose() - is something re-rendering incorrectly?
4. Check if error is being thrown but not caught somewhere
5. Consider moving subscription sync entirely out of the purchase flow (rely only on webhook)

**EAS Build Status:** 15/15 builds used for December - OUT OF BUILDS

### Next Steps (Next Month / When Builds Available):
1. **Add extensive logging** to track exactly where the hang occurs
2. **Test with webhook-only sync** - remove all client-side sync after purchase
3. **Investigate buildAuthUser()** - may be the bottleneck
4. **Consider simpler flow:** Purchase → close modal → let webhook handle sync → user refreshes manually

### What IS Working:
- ✅ Subscription products load from RevenueCat/App Store
- ✅ Purchase flow completes (Apple confirms purchase)
- ✅ Pro features unlock after reinstall
- ✅ Subscription syncs to Supabase database
- ✅ Modal UI shows "Quarterly" properly

### Testing Notes:
- TestFlight automatically sandboxes purchases - use your regular Apple ID
- No need to sign out of App Store or use sandbox accounts
- After purchase bug, delete app and reinstall from TestFlight to test again

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
