import { supabase } from '@/lib/supabase';
import { mapPauseErrorMessage } from '@/utils/pauseErrors';

const normalizeError = (error: any): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'object' && error !== null) {
    if (typeof error.details === 'string' && error.details.trim()) return error.details;
    const context = (error as any).context;
    if (typeof context === 'string' && context.trim()) return context;
    if (context && typeof context === 'object') {
      if (typeof context.error === 'string' && context.error.trim()) return context.error;
      if (typeof context.message === 'string' && context.message.trim()) return context.message;
      const response = (context as any).response;
      if (response && typeof response === 'object') {
        if (typeof response.error === 'string' && response.error.trim()) return response.error;
        if (typeof response.message === 'string' && response.message.trim()) return response.message;
        if (typeof response.body === 'string' && response.body.trim()) {
          try {
            const parsed = JSON.parse(response.body);
            if (parsed?.error) return String(parsed.error);
            if (parsed?.message) return String(parsed.message);
          } catch {
            return response.body;
          }
        }
      }
    }
    if (typeof (error as any).response === 'object') {
      const resp = (error as any).response;
      if (typeof resp.error === 'string' && resp.error.trim()) return resp.error;
      if (typeof resp.message === 'string' && resp.message.trim()) return resp.message;
    }
  }
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Unexpected error';
};

export async function pauseSubscription(userId: string): Promise<void> {
  const result = await supabase.functions.invoke('stripe-manage-pause', {
    body: {
      action: 'pause',
      userId,
      organizationId: null,
    },
  });

  if (result.error) {
    if (__DEV__) {
      console.error('pauseSubscription raw error', result);
    }

    let responseBody: string | null = null;
    if (result.response) {
      try {
        responseBody = await result.response.text();
        if (__DEV__ && responseBody) {
          console.error('pauseSubscription error body', responseBody);
        }
      } catch (parseError) {
        if (__DEV__) {
          console.warn('pauseSubscription failed to read error body', parseError);
        }
      }
    }

    let sourceForNormalization: unknown = result.error;
    if (responseBody) {
      try {
        sourceForNormalization = JSON.parse(responseBody);
      } catch {
        sourceForNormalization = responseBody;
      }
    }

    const friendly = mapPauseErrorMessage(normalizeError(sourceForNormalization ?? result.error));
    throw new Error(friendly);
  }
}

export async function resumeSubscription(userId: string): Promise<void> {
  const result = await supabase.functions.invoke('stripe-manage-pause', {
    body: {
      action: 'resume',
      userId,
      organizationId: null,
    },
  });

  if (result.error) {
    if (__DEV__) {
      console.error('resumeSubscription raw error', result);
    }

    let responseBody: string | null = null;
    if (result.response) {
      try {
        responseBody = await result.response.text();
        if (__DEV__ && responseBody) {
          console.error('resumeSubscription error body', responseBody);
        }
      } catch (parseError) {
        if (__DEV__) {
          console.warn('resumeSubscription failed to read error body', parseError);
        }
      }
    }

    let sourceForNormalization: unknown = result.error;
    if (responseBody) {
      try {
        sourceForNormalization = JSON.parse(responseBody);
      } catch {
        sourceForNormalization = responseBody;
      }
    }

    const friendly = mapPauseErrorMessage(normalizeError(sourceForNormalization ?? result.error));
    throw new Error(friendly);
  }
}
