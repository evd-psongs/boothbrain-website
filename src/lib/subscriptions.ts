import { supabase } from '@/lib/supabase';
import { mapPauseErrorMessage } from '@/utils/pauseErrors';

const normalizeError = (error: any): string => {
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

export async function pauseSubscription(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('stripe-manage-pause', {
    body: {
      action: 'pause',
      userId,
      organizationId: null,
    },
  });

  if (error) {
    const friendly = mapPauseErrorMessage(normalizeError(error));
    throw new Error(friendly);
  }
}

export async function resumeSubscription(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('stripe-manage-pause', {
    body: {
      action: 'resume',
      userId,
      organizationId: null,
    },
  });

  if (error) {
    const friendly = mapPauseErrorMessage(normalizeError(error));
    throw new Error(friendly);
  }
}
