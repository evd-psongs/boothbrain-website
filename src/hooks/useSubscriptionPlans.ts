import { useMemo } from 'react';

import type { SubscriptionPlan } from '@/types/auth';

type UseStaticPlans = {
  data: SubscriptionPlan[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: null;
};

const PRO_PLAN: SubscriptionPlan = {
  id: 'pro-plan',
  name: 'Pro',
  tier: 'pro',
  maxInventoryItems: null,
  priceCents: 2700,
  currency: 'USD',
  billingIntervalMonths: 3,
};

export function useSubscriptionPlans(): UseStaticPlans {
  const plans = useMemo(() => [PRO_PLAN], []);

  return {
    data: plans,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  };
}
