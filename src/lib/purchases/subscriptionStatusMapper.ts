/**
 * Subscription Status Mapper
 * Shared logic for mapping subscription states between RevenueCat and Supabase
 *
 * This ensures consistent status mapping across:
 * - Client-side sync (subscriptionSync.ts)
 * - Server-side webhook (revenuecat-webhook edge function)
 */

export type SubscriptionStatusInput = {
  periodType?: string; // 'NORMAL', 'INTRO', 'TRIAL', 'PREPAID'
  willRenew?: boolean;
  unsubscribeDetectedAt?: string | null;
  eventType?: string; // Webhook events: 'INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', etc.
  isTrial?: boolean;
};

/**
 * Map RevenueCat subscription state to Supabase status
 *
 * @param input - Subscription state from RevenueCat (client or webhook)
 * @returns Supabase subscription status
 */
export function mapSubscriptionStatus(input: SubscriptionStatusInput): {
  status: string;
  canceledAt: string | null;
} {
  let status: string;
  let canceledAt: string | null = null;

  // Webhook-based mapping (when eventType is provided)
  if (input.eventType) {
    switch (input.eventType) {
      case 'INITIAL_PURCHASE':
        status = input.isTrial ? 'trialing' : 'active';
        break;
      case 'RENEWAL':
        status = 'active';
        break;
      case 'CANCELLATION':
        status = 'canceled';
        canceledAt = new Date().toISOString();
        break;
      case 'EXPIRATION':
        status = 'canceled';
        break;
      case 'BILLING_ISSUE':
        status = 'past_due';
        break;
      default:
        status = input.willRenew ? 'active' : 'canceled';
    }
  }
  // Client-based mapping (when periodType is provided)
  else {
    if (input.periodType === 'TRIAL') {
      status = 'trialing';
    } else if (input.willRenew) {
      status = 'active';
    } else if (input.unsubscribeDetectedAt) {
      status = 'canceled';
      canceledAt = input.unsubscribeDetectedAt;
    } else {
      status = 'active';
    }
  }

  return { status, canceledAt };
}
