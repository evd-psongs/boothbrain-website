import { supabase } from '@/lib/supabase';
import { mapPauseErrorMessage } from '@/utils/pauseErrors';

const normalizeError = (error: unknown): string => {
  if (!error) return 'Unknown error';

  // Handle string errors
  if (typeof error === 'string') return error;

  // Handle Error instances
  if (error instanceof Error) return error.message;

  // Handle object errors
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check for details field
    if (typeof errorObj.details === 'string' && errorObj.details.trim()) return errorObj.details;

    // Check for context field
    const context = errorObj.context;
    if (typeof context === 'string' && context.trim()) return context;
    if (context && typeof context === 'object') {
      const contextObj = context as Record<string, unknown>;
      if (typeof contextObj.error === 'string' && contextObj.error.trim()) return contextObj.error;
      if (typeof contextObj.message === 'string' && contextObj.message.trim()) return contextObj.message;

      const response = contextObj.response;
      if (response && typeof response === 'object') {
        const responseObj = response as Record<string, unknown>;
        if (typeof responseObj.error === 'string' && responseObj.error.trim()) return responseObj.error;
        if (typeof responseObj.message === 'string' && responseObj.message.trim()) return responseObj.message;
        if (typeof responseObj.body === 'string' && responseObj.body.trim()) {
          try {
            const parsed = JSON.parse(responseObj.body);
            if (parsed?.error) return String(parsed.error);
            if (parsed?.message) return String(parsed.message);
          } catch {
            return responseObj.body;
          }
        }
      }
    }

    // Check for response field
    if (typeof errorObj.response === 'object' && errorObj.response) {
      const resp = errorObj.response as Record<string, unknown>;
      if (typeof resp.error === 'string' && resp.error.trim()) return resp.error;
      if (typeof resp.message === 'string' && resp.message.trim()) return resp.message;
    }

    // Check for message and error fields
    if (typeof errorObj.message === 'string') return errorObj.message;
    if (typeof errorObj.error === 'string') return errorObj.error;
  }

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
