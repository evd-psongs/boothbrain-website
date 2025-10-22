import { Linking } from 'react-native';

import { supabase } from '@/lib/supabase';

export type BillingInterval = 'monthly' | 'yearly';

type CheckoutSessionInput = {
  planTier: string;
  userId: string;
  interval?: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
};

type BillingPortalInput = {
  userId: string;
  returnUrl?: string;
};

const extractFunctionError = (error: any): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'object' && error !== null) {
    if (typeof error.details === 'string' && error.details.trim()) return error.details;
    if (typeof error.context === 'string' && error.context.trim()) return error.context;
  }
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Unexpected error';
};

const openUrl = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('Unable to open checkout link on this device.');
  }
  await Linking.openURL(url);
};

export async function startCheckoutSession(input: CheckoutSessionInput): Promise<void> {
  const { planTier, userId, interval, successUrl, cancelUrl } = input;
  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: {
      planTier,
      interval,
      userId,
      successUrl,
      cancelUrl,
      // Temporary compatibility while backend migrates away from organizations.
      organizationId: null,
    },
  });

  if (error) {
    throw new Error(extractFunctionError(error));
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  await openUrl(url);
}

export async function openBillingPortal(input: BillingPortalInput): Promise<void> {
  const { userId, returnUrl } = input;

  const directPortalUrl = process.env.EXPO_PUBLIC_STRIPE_PORTAL_URL;
  if (directPortalUrl) {
    await openUrl(directPortalUrl);
    return;
  }

  const { data, error } = await supabase.functions.invoke('stripe-billing-portal', {
    body: {
      userId,
      returnUrl,
      organizationId: null,
    },
  });

  if (error) {
    throw new Error(extractFunctionError(error));
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error('Stripe did not return a billing portal URL.');
  }

  await openUrl(url);
}
