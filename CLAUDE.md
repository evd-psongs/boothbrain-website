# CLAUDE.md - BoothBrain Development Guide

## Project Overview
BoothBrain is an Expo React Native app for managing vendor booth inventory and sales.

## Refactoring Achievement Summary (2025-11-06)
🎉 **Major refactoring milestone completed!**
- Started with 4 screens over 1,600 lines each + 2 providers over 350 lines
- Extracted 30 reusable components and service modules
- Removed 3,436 lines of code while improving functionality
- All major files now under 1,300 lines (most under 200 lines)
- Created clear separation of concerns with dedicated service layers

## Last Session (2025-11-10)
- ✅ **Fixed all ESLint unused variable/import errors** - 22 errors resolved across 10 files
- ✅ Cleaned up unused imports and variables:
  - `home.tsx`: Removed formatDateLabel, isFutureEvent, sortEventsByDate, getEventPhase, getEventPhaseForEvent
  - `sale.tsx`: Removed KeyboardAvoidingView, Platform, ScrollView, Switch, CartLine, DISCOUNT_PRESETS, PAYMENT_BUTTONS
  - `settings.tsx`: Removed useRef, InputField, InputFieldProps, formatRelativeTime function
  - `EventModal.tsx`: Removed useEffect
  - `SessionManagementSection.tsx`: Removed SESSION_CODE_LENGTH
  - `useAuthOperations.ts`: Removed User type import
  - `useCrashlyticsUser.ts`: Removed unused session variable
  - `SessionProvider.tsx`: Removed SESSION_CODE_LENGTH from type imports
  - `SupabaseAuthProvider.tsx`: Removed User type import
  - `asyncHelpers.ts`: Removed unused lastPromise variable
- ✅ TypeScript compilation still passes with zero errors
- ⚠️ 2 parsing errors remain in Stripe webhook functions (missing catch/finally blocks)

Previous session (2025-11-09):
- ✅ **Fixed session ending error** - PostgREST schema mismatch resolved
- ✅ Fixed "Could not find the 'ended_at' column" error when ending sessions:
  - Updated `sessionApi.ts` to use `is_active: false` instead of non-existent `ended_at` column
  - Sessions table uses `is_active` boolean field, not `ended_at` timestamp
  - Added missing `is_active` field to SessionRow types in both `session.ts` and `database.ts`
  - Fixed SessionRow type in `database.ts` to match actual DB schema (added `organization_id`, `expires_at`, etc.)

Previous session (2025-11-08):
- ✅ **Major TypeScript type system overhaul completed!**
- ✅ Created comprehensive database types (`src/types/database.ts`):
  - All Supabase table row types (ProfileRow, ItemRow, OrderRow, EventRow, etc.)
  - Error handling utilities (isSupabaseError, getErrorMessage)
  - Type guards and error message extraction helpers
- ✅ Fixed all TypeScript compilation errors - `npm run typecheck` now passes!
- ✅ Removed all `any` types from error handling throughout codebase
- ✅ Updated API files to use proper database types:
  - inventory.ts, events.ts, orders.ts now fully type-safe
  - Fixed Promise type issues in auth services
- ✅ Verified all loading states are properly implemented

Previous session (2025-11-06):
- ✅ **SessionProvider refactoring** - reduced file by 265 lines (398 → 133 lines, 67% reduction!)
- ✅ Created session service modules:
  - `deviceIdService.ts` (47 lines) - Device ID generation and management
  - `sessionStorage.ts` (68 lines) - Session persistence and validation
  - `sessionApi.ts` (168 lines) - Session API operations
  - `useSessionOperations.ts` (150 lines) - Session operations hook
  - `session.ts` types (42 lines) - Session type definitions

Previous:
- ✅ **Massive SupabaseAuthProvider refactoring** - reduced file by 359 lines (556 → 197 lines, 64% reduction!)
- ✅ Created auth service modules:
  - `profileService.ts` (95 lines) - Profile fetching and updates
  - `subscriptionService.ts` (127 lines) - Subscription management
  - `authUserBuilder.ts` (23 lines) - User object construction
  - `useAuthOperations.ts` (195 lines) - Auth operations hook
- ✅ Created asyncHelpers.ts (195 lines) - reusable async utilities
  - `withTimeout` - Promise timeout wrapper
  - `withRetry` - Exponential backoff retry logic
  - `withTimeoutAndRetry` - Combined helper
  - `parallelLimit` - Concurrent operations with limit
  - `debounceAsync` - Async function debouncing
  - `getTimeout` - Platform-aware timeout configuration

Previous in session:
- ✅ **Extracted CSV logic from inventory.tsx** - reduced file by 482 lines (1,623 → 1,141)
- ✅ Created useCsvImportExport hook (217 lines) - handles all CSV import/export logic
- ✅ Created ImportModal component (143 lines) - CSV and Google Sheets import UI
- ✅ Created ImportSummaryCard component (64 lines) - displays import results
- ✅ Created InventoryListItem component (82 lines) - reusable item display

Previous:
- ✅ **Extracted event components from home.tsx** - reduced file by 656 lines (1,767 → 1,111)
- ✅ Created EventModal component (453 lines) - complete event creation/editing with date picker
- ✅ Created TaskModal component (173 lines) - task management for events
- ✅ Created EventCard component (212 lines) - reusable event display component
- ✅ **Extracted modals from sale.tsx** - reduced file by 592 lines (1,863 → 1,271)
- ✅ **Completed settings.tsx refactoring** - reduced from 2,174 → 1,092 lines

Previous session (2025-10-31):
- ✅ Fixed dev server permission errors - cleaned node_modules and reinstalled dependencies
- ✅ Reorganized file structure - moved misplaced files to correct `/src` directories
- ✅ Created Firebase mock for Expo Go - app now runs without development build

## Current Focus
- ✅ **COMPLETED:** settings.tsx refactoring (2,174 → 1,092 lines, 50% reduction)
- ✅ **COMPLETED:** sale.tsx modal extraction (1,863 → 1,271 lines, 32% reduction)
- ✅ **COMPLETED:** home.tsx event extraction (1,767 → 1,111 lines, 37% reduction)
- ✅ **COMPLETED:** inventory.tsx CSV extraction (1,623 → 1,141 lines, 30% reduction)
- ✅ **COMPLETED:** SupabaseAuthProvider refactoring (556 → 197 lines, 64% reduction)
- ✅ **COMPLETED:** SessionProvider refactoring (398 → 133 lines, 67% reduction)
- ✅ **COMPLETED:** TypeScript type system overhaul - zero compilation errors!
- 🎉 **Major refactoring complete!** All critical files and providers now under control
- ✅ **Dev environment is stable** - `npm run typecheck` passes with no errors
- ✅ **ESLint cleanup complete** - Fixed 22 unused variable/import errors (2025-11-10)
- 🔧 **Current phase:** Code quality improvements and bug fixing
- 🎯 **Next priorities:** Fix Stripe webhook parsing errors, continue testing functionality, then feature development

## Refactoring Impact Summary
- **Total lines removed:** ~3,436 lines across major screens and providers
  - settings.tsx: 1,082 lines removed (50% reduction)
  - sale.tsx: 592 lines removed (32% reduction)
  - home.tsx: 656 lines removed (37% reduction)
  - inventory.tsx: 482 lines removed (30% reduction)
  - SupabaseAuthProvider: 359 lines removed (64% reduction)
  - SessionProvider: 265 lines removed (67% reduction)
- **Components extracted:** 30+ total components
  - 4 settings components
  - 2 sale modal components
  - 3 event components
  - 5 inventory components (hook, modals, list item)
  - 4 auth service modules (profile, subscription, builder, operations)
  - 5 session service modules (device, storage, API, operations, types)
  - 6 common UI components
  - 1 async utilities module
- **TypeScript improvements:**
  - Created comprehensive database.ts with all Supabase row types
  - Eliminated all `any` types from error handling
  - Zero TypeScript compilation errors
  - Added proper type safety for all API operations
- **Duplicate code eliminated:** Yes (formatEventRange, formatPaymentLabel, async helpers, device ID management)
- **New utility/service files created:** 20+ files including database.ts
- **Files improved:** 9 major screens/providers + all hooks and services

## Tech Stack
- **Framework:** Expo (React Native)
- **Database:** Supabase
- **Auth:** Supabase Auth
- **Styling:** NativeWind (Tailwind for RN)
- **State:** Zustand + React Query
- **Error Tracking:** Firebase Crashlytics
- **Navigation:** Expo Router

## Recent Changes
- **2025-10-31:** Fixed file structure - moved files to correct `/src` directories
- **2025-10-31:** Created Firebase mock implementation for Expo Go compatibility
- **2025-10-31:** Fixed dev server permission errors and reinstalled dependencies
- **2025-10-30:** Integrated SessionManagementSection into settings.tsx (412 lines removed)
- **2025-10-30:** Removed unused session-related styles (122 lines)
- **2025-10-29:** Added Firebase Crashlytics for error monitoring
- **2025-10-29:** Removed Sentry monitoring infrastructure
- **2025-10-29:** Extracted common components from settings screen (203 lines reduced)
- **2025-10-29:** Extracted date and payment utilities (87 lines removed, duplicates eliminated)
- **2025-10-29:** Created SessionManagementSection component (322 lines)

## Refactoring Progress

### Priority 1: Critical Files (2000+ lines)
- [✅] `app/(tabs)/settings.tsx` (~~2,174~~ → 1,092 lines) → **COMPLETED! 50% reduction**
- [✅] `app/(tabs)/sale.tsx` (~~1,863~~ → 1,271 lines) → **COMPLETED! 32% reduction**
- [✅] `app/(tabs)/home.tsx` (~~1,767~~ → 1,111 lines) → **COMPLETED! 37% reduction**
- [✅] `app/(tabs)/inventory.tsx` (~~1,623~~ → 1,141 lines) → **COMPLETED! 30% reduction**

### Priority 2: Providers
- [✅] `SupabaseAuthProvider` (~~556~~ → 197 lines) → **COMPLETED! 64% reduction**
- [✅] `SessionProvider` (~~398~~ → 133 lines) → **COMPLETED! 67% reduction**

### Priority 3: Shared Utilities
- [✅] Created `/src/components/common/` with reusable UI components
- [✅] Created `/src/utils/dates.ts`:
  - `formatTimeAgo()` - Relative time formatting ("2 hours ago")
  - `formatTimestamp()` - Full date/time display
  - `formatDateLabel()` - Simple date display
  - `formatEventRange()` - Date range formatting
  - `getEventPhase()` - Event phase detection (prep/live/post)
  - `isFutureEvent()`, `sortEventsByDate()`, `getDaysBetween()`
- [✅] Created `/src/utils/payment.ts`:
  - `formatPaymentLabel()` - Payment method formatting
  - `getPaymentIcon()` - Icon mapping for payment methods
  - `getPaymentVisuals()` - Complete visual configuration
  - `isValidPaymentLink()` - Payment URL validation
  - `formatPaymentAmount()` - Currency formatting
- [✅] Created `/src/utils/asyncHelpers.ts`:
  - `withTimeout()` - Wrap promises with timeout
  - `withRetry()` - Retry with exponential backoff
  - `withTimeoutAndRetry()` - Combined timeout and retry
  - `parallelLimit()` - Run promises with concurrency limit
  - `debounceAsync()` - Debounce async functions
  - `delay()` - Create delay promise
  - `getTimeout()` - Platform-aware timeout configuration

### Completed Components
#### Common UI Components (`/src/components/common/`)
- `PrimaryButton` - Main action buttons
- `SecondaryButton` - Alternative action buttons
- `InputField` - Form inputs with labels
- `SectionHeading` - Section headers
- `FeedbackBanner` - Animated success/error messages

#### Settings Components (`/src/components/settings/`)
- `SessionManagementSection` - Session creation and management (322 lines, ✅ integrated)
- `ProfileSection` - User profile management (136 lines, ✅ integrated)
- `PasswordSection` - Password update functionality (100 lines, ✅ integrated)
- `PaymentSettingsSection` - Payment preferences and PayPal QR (378 lines, ✅ integrated)

#### Modal Components (`/src/components/modals/`)
- `CheckoutModal` - Complete checkout UI with payments (534 lines, ✅ integrated)
- `QuantityModal` - Item quantity adjustment modal (140 lines, ✅ integrated)

#### Event Components (`/src/components/events/`)
- `EventModal` - Event creation/editing with date picker (453 lines, ✅ integrated)
- `TaskModal` - Task management for events (173 lines, ✅ integrated)
- `EventCard` - Reusable event display component (212 lines, ✅ integrated)

#### Inventory Components (`/src/components/inventory/`)
- `ImportModal` - CSV and Google Sheets import UI (143 lines, ✅ integrated)
- `ImportSummaryCard` - Import results display (64 lines, ✅ integrated)
- `InventoryListItem` - Reusable inventory item display (82 lines, ✅ integrated)

#### Inventory Hooks (`/src/hooks/`)
- `useCsvImportExport` - CSV import/export logic (217 lines, ✅ integrated)

## Code Organization Guidelines

### File Size Limits
- **Components:** Max 300 lines
- **Hooks:** Max 150 lines
- **Utils:** Max 100 lines per function
- **Providers:** State management only (delegate logic to hooks)

### Folder Structure
```
src/
├── components/
│   ├── common/        # ✅ Reusable UI (buttons, inputs, banners)
│   ├── settings/      # ✅ Settings screen sections (SessionManagement, etc.)
│   ├── screens/       # 🔄 Screen-specific components (planned)
│   ├── modals/        # 🔄 Standalone modals (planned)
│   └── ErrorBoundary.tsx # ✅ Error boundary component
├── hooks/             # Business logic hooks
│   └── useCrashlyticsUser.ts # ✅ Firebase user sync hook
├── lib/
│   ├── services/      # External service integrations
│   │   └── firebase.ts # ✅ Firebase Crashlytics (mocked for Expo Go)
│   └── [supabase operations & business logic]
├── providers/         # Context providers (Auth, Session, Theme)
├── utils/             # ✅ Pure utility functions
│   ├── dates.ts       # Date/time formatting
│   ├── payment.ts     # Payment method utilities
│   └── currency.ts    # Currency formatting
└── types/             # TypeScript type definitions
```

### Single Responsibility Examples
```typescript
// ❌ BAD: Multiple responsibilities
export function SettingsScreen() {
  // Profile management
  // Password updates
  // Payment settings
  // Subscription management
  // Session creation
}

// ✅ GOOD: Single purpose
export function ProfileSection() {
  // Only profile updates
}
```

## Testing Strategy
- Unit test utilities and hooks
- Integration test providers
- E2E test critical user flows

## Documentation Standards
- Every exported function needs JSDoc
- Complex logic needs inline comments
- Update this file after major changes

## Performance Targets
- Screen load: < 500ms
- List scroll: 60fps
- Bundle size: < 50MB

## Known Issues
- ✅ ~~Settings screen too large~~ (Completed - reduced from 2,174 to 1,092 lines)
- ✅ ~~sale.tsx too large~~ (Completed - reduced from 1,863 to 1,271 lines)
- ✅ ~~home.tsx too large~~ (Completed - reduced from 1,767 to 1,111 lines)
- ✅ ~~inventory.tsx too large~~ (Completed - reduced from 1,623 to 1,141 lines)
- ✅ ~~SupabaseAuthProvider too large~~ (Completed - reduced from 556 to 197 lines)
- ✅ ~~SessionProvider too large~~ (Completed - reduced from 398 to 133 lines)
- ✅ ~~Missing loading states in some API calls~~ (Completed - all hooks verified)
- ✅ ~~Some TypeScript types could be improved~~ (Completed - zero compilation errors)
- ✅ ~~Session ending PostgREST error~~ (Fixed 2025-11-09 - schema mismatch resolved)
- ⚠️ **Parsing errors in Stripe webhook functions** (2 errors):
  - `supabase/functions/stripe-manage-pause/index.ts:257` - Missing catch/finally block
  - `supabase/functions/stripe-webhook/index.ts:238` - Missing catch/finally block
- No major architectural issues remaining - codebase is clean and maintainable!

## Next Tasks
1. ✅ ~~Extract shared button components~~ (Completed)
2. ✅ ~~Create date formatting utilities~~ (Completed)
3. ✅ ~~Create payment utilities~~ (Completed)
4. ✅ ~~Integrate SessionManagementSection into settings.tsx~~ (Completed)
5. ✅ ~~Extract ProfileSection from settings.tsx~~ (Completed)
6. ✅ ~~Extract PasswordSection from settings.tsx~~ (Completed)
7. ✅ ~~Extract PaymentSettingsSection from settings.tsx~~ (Completed)
8. ✅ ~~Extract CheckoutModal and QuantityModal from sale.tsx~~ (Completed)
9. ✅ ~~Extract event management from home.tsx~~ (Completed)
10. ✅ ~~Extract CSV logic from inventory.tsx~~ (Completed)
11. ✅ ~~Extract async helpers (withTimeout, withRetry) from SupabaseAuthProvider~~ (Completed)
12. ✅ ~~Continue refactoring SupabaseAuthProvider~~ (Completed - 556 → 197 lines)
13. ✅ ~~Refactor SessionProvider~~ (Completed - 398 → 133 lines)
14. ✅ ~~Add proper TypeScript types for all API responses~~ (Completed - created database.ts)
15. ✅ ~~Add missing loading states in API calls~~ (Completed - verified all hooks have loading states)
16. Performance optimization (lazy loading, memoization)
17. Add comprehensive error boundaries
18. Implement proper offline support
19. Add unit tests for critical business logic

## Important Reminders & Don'ts
- ✅ **ALL 6 major files/providers refactored:**
  - settings.tsx (50%), sale.tsx (32%), home.tsx (37%), inventory.tsx (30%)
  - SupabaseAuthProvider (64%), SessionProvider (67%)
- ✅ **30 components/modules extracted** - improved code organization and reusability
- ✅ **3,436 total lines removed** - massive codebase simplification
- ⚠️ **Some components over 300 lines:** CheckoutModal (534), EventModal (453), PaymentSettingsSection (378)
- ⚠️ **These larger components are acceptable** - they contain complete, cohesive functionality
- ⚠️ **Firebase is mocked for Expo Go** - Real implementation commented in `/src/lib/services/firebase.ts`
- ⚠️ **To use real Firebase:** Create dev build with `npx expo run:android` or `npx expo run:ios`, then uncomment real implementation
- ⚠️ **Firebase config files are in root** (google-services.json, GoogleService-Info.plist) - already set up
- ⚠️ **All imports use `@/` alias** - Maps to `/src/*` directory per tsconfig.json
- ⚠️ **formatEventRange() was duplicated** - now centralized in dates.ts
- ⚠️ **formatPaymentLabel() was duplicated** - now centralized in payment.ts
- 🎉 **Major refactoring complete!** All critical files now under control

## Notes for Claude
- 📖 **Always read this file first** at the start of each session
- Prioritize code readability over cleverness
- Extract components when files exceed 300 lines
- Always update this file after refactoring (especially Last Session and Current Focus)
- Use custom hooks for business logic
- Keep components focused on rendering
- Run `wc -l filename` to check file sizes before/after refactoring
- Commit frequently with descriptive messages