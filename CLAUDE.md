# CLAUDE.md - BoothBrain Development Guide

## Project Overview
BoothBrain is an Expo React Native app for managing vendor booth inventory and sales.

## Last Session (2025-10-31)
- ✅ **Fixed dev server permission errors** - cleaned node_modules and reinstalled dependencies
- ✅ **Reorganized file structure** - moved misplaced files to correct `/src` directories:
  - Moved `ErrorBoundary.tsx` from `/components` to `/src/components`
  - Moved `firebase.ts` from `/lib/services` to `/src/lib/services`
  - Moved `useCrashlyticsUser.ts` from `/hooks` to `/src/hooks`
- ✅ **Created Firebase mock for Expo Go** - app now runs without development build
- ✅ Cleaned up orphaned directories (`/components`, `/lib`, `/hooks`)
- ✅ Updated imports to use correct `@/` alias paths

## Current Focus
- 🎯 **Priority:** Extract ProfileSection from settings.tsx (next component)
- 🎯 **Goal:** Reduce settings.tsx from 1,559 lines to under 500 lines
- 🔄 Extract remaining sections: ProfileSection, PasswordSection, PaymentSettingsSection
- 🔄 Then tackle sale.tsx modal extractions (CheckoutModal, QuantityModal)
- ✅ **Dev environment is now stable** - ready to continue refactoring

## Refactoring Impact Summary
- **Total lines removed:** ~702 lines (290 + 412 from SessionManagement integration)
- **Duplicate code eliminated:** Yes (formatEventRange, formatPaymentLabel)
- **New utility files created:** 9 files
- **Components extracted:** 7 reusable components (including SessionManagementSection)
- **Files improved:** 6 major screens

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
- [🔧] `app/(tabs)/settings.tsx` (~~2,174~~ → ~~1,971~~ → 1,559 lines) → Still needs 3 more sections extracted
- [ ] `app/(tabs)/sale.tsx` (1,863 lines) → Extract modals and calculations
- [ ] `app/(tabs)/home.tsx` (1,767 lines) → Separate event management
- [ ] `app/(tabs)/inventory.tsx` (1,623 lines) → Extract CSV logic

### Priority 2: Providers
- [ ] `SupabaseAuthProvider` (556 lines) → Separate auth from profile/subscription
- [ ] `SessionProvider` (398 lines) → Extract device ID management

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
- [ ] Create `/src/utils/asyncHelpers.ts`

### Completed Components
#### Common UI Components (`/src/components/common/`)
- `PrimaryButton` - Main action buttons
- `SecondaryButton` - Alternative action buttons
- `InputField` - Form inputs with labels
- `SectionHeading` - Section headers
- `FeedbackBanner` - Animated success/error messages

#### Settings Components (`/src/components/settings/`)
- `SessionManagementSection` - Session creation and management (322 lines, ✅ integrated)

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
- Settings screen still needs refactoring (1,559 lines - need to extract 3 more sections)
- sale.tsx is too large (1,863 lines) - needs modal extraction
- home.tsx is too large (1,767 lines) - needs event management separation
- inventory.tsx is too large (1,623 lines) - needs CSV logic extraction
- Missing loading states in some API calls

## Next Tasks
1. ✅ ~~Extract shared button components~~ (Completed)
2. ✅ ~~Create date formatting utilities~~ (Completed)
3. ✅ ~~Create payment utilities~~ (Completed)
4. ✅ ~~Integrate SessionManagementSection into settings.tsx~~ (Completed)
5. Extract ProfileSection from settings.tsx (next priority)
6. Extract PasswordSection and PaymentSettingsSection from settings.tsx
7. Extract CheckoutModal and QuantityModal from sale.tsx
8. Extract async helpers (withTimeout, withRetry) from SupabaseAuthProvider
9. Add proper TypeScript types for all API responses

## Important Reminders & Don'ts
- ✅ **SessionManagementSection is integrated** - reduced settings.tsx by 412 lines
- ⚠️ **Firebase is mocked for Expo Go** - Real implementation commented in `/src/lib/services/firebase.ts`
- ⚠️ **To use real Firebase:** Create dev build with `npx expo run:android` or `npx expo run:ios`, then uncomment real implementation
- ⚠️ **Firebase config files are in root** (google-services.json, GoogleService-Info.plist) - already set up
- ⚠️ **All imports use `@/` alias** - Maps to `/src/*` directory per tsconfig.json
- ⚠️ **formatEventRange() was duplicated** - now centralized in dates.ts
- ⚠️ **formatPaymentLabel() was duplicated** - now centralized in payment.ts
- 📝 **settings.tsx needs 3 more sections extracted** - ProfileSection, PasswordSection, PaymentSettingsSection

## Notes for Claude
- 📖 **Always read this file first** at the start of each session
- Prioritize code readability over cleverness
- Extract components when files exceed 300 lines
- Always update this file after refactoring (especially Last Session and Current Focus)
- Use custom hooks for business logic
- Keep components focused on rendering
- Run `wc -l filename` to check file sizes before/after refactoring
- Commit frequently with descriptive messages