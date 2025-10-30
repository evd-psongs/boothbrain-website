# CLAUDE.md - BoothBrain Development Guide

## Project Overview
BoothBrain is an Expo React Native app for managing vendor booth inventory and sales.

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
- [✅] Created `/src/utils/dates.ts` with date/time formatting utilities
- [✅] Created `/src/utils/payment.ts` with payment formatting utilities
- [ ] Create `/src/utils/asyncHelpers.ts`

### Completed Components
- `PrimaryButton` - Main action buttons
- `SecondaryButton` - Alternative action buttons
- `InputField` - Form inputs with labels
- `SectionHeading` - Section headers
- `FeedbackBanner` - Animated success/error messages

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
│   ├── common/        # Reusable UI (buttons, inputs)
│   ├── screens/       # Screen-specific components
│   └── modals/        # Standalone modals
├── hooks/             # Business logic hooks
├── lib/
│   ├── queries/       # Database read operations
│   ├── mutations/     # Database write operations
│   └── mappers/       # Data transformation
└── utils/             # Pure utility functions
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
- Settings screen needs urgent refactoring (2000+ lines)
- No proper error boundaries in some screens
- Missing loading states in some API calls

## Next Tasks
1. Refactor settings.tsx into separate components
2. Extract shared button components
3. Create date formatting utilities
4. Add proper TypeScript types for all API responses

## Notes for Claude
- Prioritize code readability over cleverness
- Extract components when files exceed 300 lines
- Always update this file after refactoring
- Use custom hooks for business logic
- Keep components focused on rendering