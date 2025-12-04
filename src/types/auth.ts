export type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  lastSeenAt: string | null;
};

export type SubscriptionPlanTier = 'free' | 'pro' | 'enterprise';

export type SubscriptionPlan = {
  id: string;
  name: string;
  tier: SubscriptionPlanTier;
  maxInventoryItems?: number | null;
  currency?: string | null;
  priceCents?: number | null;
  billingIntervalMonths?: number | null;
};

export type Subscription = {
  id: string;
  userId: string;
  plan: SubscriptionPlan | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  trialEndsAt: string | null;
  pausedAt: string | null;
  pauseUsedPeriodStart: string | null;
  pauseAllowanceUsed: boolean;
  // Apple IAP fields (Phase 2)
  paymentPlatform?: 'stripe' | 'apple' | 'google';
  appleOriginalTransactionId?: string | null;
  appleProductId?: string | null;
};

export type AuthUser = {
  id: string;
  email?: string;
  profile: Profile | null;
  subscription: Subscription | null;
};

export type SignUpData = {
  email: string;
  password: string;
  fullName?: string;
  businessName?: string;
};

export type SignInData = {
  email: string;
  password: string;
};
