import { Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';

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
    if (typeof error.context === 'object' && error.context !== null) {
      const { body } = error.context as { body?: string };
      if (typeof body === 'string' && body.trim()) {
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) return parsed.error;
          if (parsed?.message) return parsed.message;
          return body;
        } catch {
          return body;
        }
      }
    }
  }
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Unexpected error';
};

const openUrl = async (url: string) => {
  if (!url) return;
  const parsed = ExpoLinking.parse(url);
  if (parsed?.scheme && parsed.scheme.startsWith('exp')) {
    console.log('[Billing] Dev stub redirect skipped for Expo URL:', url);
    return;
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('Unable to open checkout link on this device.');
  }
  await Linking.openURL(url);
};

export async function startCheckoutSession(input: CheckoutSessionInput): Promise<void> {
  const {
    planTier,
    userId,
    interval,
    successUrl,
    cancelUrl,
  } = input;

  const appOrigin = process.env.EXPO_PUBLIC_SITE_URL
    || (typeof ExpoLinking.createURL === 'function' ? ExpoLinking.createURL('/') : undefined)
    || 'https://boothbrain.app/';
  const normalizedOrigin = appOrigin.endsWith('/') ? appOrigin.slice(0, -1) : appOrigin;
  const fallbackSuccessUrl = successUrl ?? `${normalizedOrigin}`;
  const fallbackCancelUrl = cancelUrl ?? `${normalizedOrigin}`;
  const requestInterval: BillingInterval = interval ?? 'monthly';

  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: {
      planTier,
      interval: requestInterval,
      userId,
      successUrl: fallbackSuccessUrl,
      cancelUrl: fallbackCancelUrl,
      // Temporary compatibility while backend migrates away from organizations.
      organizationId: null,
    },
  });

  if (error) {
    console.error('stripe-create-checkout failed', error);
    const message = extractFunctionError(error);
    if (typeof message === 'string' && message.includes('Edge Function returned')) {
      throw new Error('Checkout is unavailable right now. Please contact support (hello@boothbrain.com) so we can enable billing.');
    }
    throw new Error(message);
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
    console.error('stripe-billing-portal failed', error);
    const message = extractFunctionError(error);
    if (typeof message === 'string' && message.includes('Edge Function returned')) {
      throw new Error('Billing portal is unavailable right now. Please contact support (hello@boothbrain.com).');
    }
    throw new Error(message);
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error('Stripe did not return a billing portal URL.');
  }

  await openUrl(url);
}
