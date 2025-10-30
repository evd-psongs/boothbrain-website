# CLAUDE.md - BoothBrain Development Guide

## Project Overview
BoothBrain is an Expo React Native app for managing vendor booth inventory and sales.

## Refactoring Impact Summary
- **Total lines removed:** ~290 lines
- **Duplicate code eliminated:** Yes (formatEventRange, formatPaymentLabel)
- **New utility files created:** 9 files
- **Components extracted:** 6 reusable components
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
- **2024-10-30:** Added Firebase Crashlytics for error monitoring
- **2024-10-30:** Removed Sentry monitoring infrastructure
- **2024-10-30:** Extracted common components from settings screen (203 lines reduced)
- **2024-10-30:** Extracted date and payment utilities (87 lines removed, duplicates eliminated)
- **2024-10-30:** Created SessionManagementSection component (322 lines, ready for integration)

## Refactoring Progress

### Priority 1: Critical Files (2000+ lines)
- [🔧] `app/(tabs)/settings.tsx` (~~2,174~~ → 1,971 lines) → Still needs splitting into 5 sections
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
- `SessionManagementSection` - Session creation and management (322 lines, WIP integration)

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
│   └── modals/        # 🔄 Standalone modals (planned)
├── hooks/             # Business logic hooks
├── lib/               # Supabase operations & business logic
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
- Settings screen still needs refactoring (1,971 lines - SessionManagement extracted but not integrated)
- sale.tsx is too large (1,863 lines) - needs modal extraction
- home.tsx is too large (1,767 lines) - needs event management separation
- inventory.tsx is too large (1,623 lines) - needs CSV logic extraction
- Missing loading states in some API calls

## Next Tasks
1. ✅ ~~Extract shared button components~~ (Completed)
2. ✅ ~~Create date formatting utilities~~ (Completed)
3. ✅ ~~Create payment utilities~~ (Completed)
4. 🔄 Complete SessionManagementSection integration in settings.tsx
5. Extract ProfileSection, PasswordSection, PaymentSettingsSection from settings.tsx
6. Extract CheckoutModal and QuantityModal from sale.tsx
7. Extract async helpers (withTimeout, withRetry) from SupabaseAuthProvider
8. Add proper TypeScript types for all API responses

## Notes for Claude
- Prioritize code readability over cleverness
- Extract components when files exceed 300 lines
- Always update this file after refactoring
- Use custom hooks for business logic
- Keep components focused on rendering