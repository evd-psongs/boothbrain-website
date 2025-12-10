# CLAUDE.md - BoothBrain Development Guide

**Last Updated:** 2025-12-10

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
- Both `test-branch` and `master` at commit `b7dac7f` (2025-12-10)
- All branches synced and pushed to origin/master
- Clean working tree

**Quick Commands:**
```bash
git branch                  # Check current branch
git checkout test-branch   # Switch to dev branch
git checkout master        # Switch to production
npm start -- --clear       # Clear Metro cache if needed
```

---

## Current Session (2025-12-10 - UI Improvements & Code Cleanup)

### What Was Accomplished:

#### 1. **Subscription Pause Feature Removed** ✅
- Apple IAP doesn't support user-initiated subscription pauses
- Removed all pause UI, logic, types, and utility files
- Users can cancel subscriptions via iOS Settings (standard Apple flow)
- **Files removed:** `src/lib/subscriptions.ts`, `src/utils/subscriptionPause.ts`, `src/utils/pauseErrors.ts`, tests
- **Types updated:** Removed `pausedAt`, `pauseAllowanceUsed` from Subscription type

#### 2. **Performance Optimizations** ✅
- **Fix #1:** Eliminated duplicate `buildAuthUser` call on iOS auth state change
  - Tracked with `userAlreadyRefreshed` flag to skip redundant network calls
  - Saves one profile + subscription fetch per login
- **Fix #2:** Skip redundant subscription sync on `INITIAL_SESSION` event
  - Only sync on `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED` events
  - Reduces unnecessary RevenueCat API calls on app startup
- **Fix #3:** Skip database writes when subscription data unchanged
  - Compare incoming data with existing record before updating
  - Reduces Supabase API usage and database load

#### 3. **UI Spacing Improvements** ✅
- Increased Settings screen card gap from 16px to 24px
- Added 12px spacing before "Save payment links" button
- Added 12px top margin to notice boxes (e.g., iOS Settings notice)

#### 4. **Toast Notification Redesign** ✅
- Replaced solid green/red background with subtle accent border design
- New design: Surface background + 4px colored left border + primary text color
- More modern, less "shouty" appearance
- Works great in both light and dark modes

#### 5. **FeedbackBanner Consolidation** ⚠️ **IN PROGRESS**
- **Problem:** 5 duplicate implementations of FeedbackBanner (1 shared + 4 local copies)
- **Goal:** Delete local copies, use shared component from `@/components/common`
- **Status:** 3 of 4 completed (item-form.tsx ✅, sale.tsx ✅, orders.tsx ✅)
- **Remaining:** inventory.tsx (partially done, needs completion)

### In Progress - FeedbackBanner Consolidation:

**What's Left:**
1. Finish updating `app/(tabs)/inventory.tsx`:
   - Remove `infoColor` prop from usage (line 532)
   - Remove local FeedbackBanner function (starts around line 854)
   - Remove feedbackBanner & feedbackText styles
2. Run `npm run typecheck` to verify
3. Commit all changes

**Current State:**
- Import already added: `import { FeedbackBanner, type FeedbackState } from '@/components/common'`
- Local FeedbackState type already removed
- Usage still has `infoColor={theme.colors.primary}` that needs removing
- Local function still exists

**To Complete:**
```typescript
// Remove infoColor from usage (around line 532):
<FeedbackBanner
  feedback={feedback}
  successColor={theme.colors.success}
  errorColor={theme.colors.error}
  // DELETE THIS LINE: infoColor={theme.colors.primary}
  surfaceColor={theme.colors.surface}
  textColor={theme.colors.textPrimary}
/>

// Delete entire local FeedbackBanner function (around line 854-882)
// Delete feedbackBanner and feedbackText styles from StyleSheet
```

**Benefits After Completion:**
- ~100 lines of duplicate code removed
- All toasts animated consistently (shared component has animations)
- Single source of truth for future toast changes

### Key Commits (2025-12-10):
- `5721296` - Remove: Subscription pause feature (not supported by Apple IAP)
- `bcae93b` - Perf: Skip database writes when subscription data unchanged
- `4590dab` - UI: Increase spacing between Settings screen cards
- `b529b16` - UI: Add spacing between Remove QR code and Save payment links buttons
- `a77740c` - UI: Add spacing between Refresh button and iOS Settings notice
- `b7dac7f` - UI: Redesign toast notifications with subtle accent border design

**Note:** Previous session details (2025-12-09 post-purchase fix, 2025-12-07 RevenueCat integration) moved to `/docs/archive/SESSION_HISTORY.md`

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
- ✅ Post-purchase infinite loading (removed duplicate sync, single source of truth)
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
