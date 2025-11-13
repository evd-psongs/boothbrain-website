import { useCallback, useEffect, useState } from 'react';

import { fetchOrders } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types/orders';
import { getErrorMessage } from '@/types/database';

export function useOrders(userId: string | null | undefined, sessionId?: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      if (!userId) {
        setOrders([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchOrders({ userId, sessionId: sessionId ?? null });
        if (!options?.signal?.aborted) {
          setOrders(data);
        }
      } catch (err) {
        if (!options?.signal?.aborted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!options?.signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [sessionId, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders({ signal: controller.signal });
    return () => controller.abort();
  }, [loadOrders]);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`orders:${userId}:${sessionId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `owner_user_id=eq.${userId}`,
        },
        (payload) => {
          if (sessionId) {
            const newSession = (payload.new as { event_id?: string | null } | null)?.event_id;
            const oldSession = (payload.old as { event_id?: string | null } | null)?.event_id;
            if (newSession !== sessionId && oldSession !== sessionId) {
              return;
            }
          }
          void loadOrders();
        },
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [loadOrders, sessionId, userId]);

  const refresh = useCallback(async () => {
    await loadOrders();
  }, [loadOrders]);

  return {
    orders,
    loading,
    error,
    refresh,
  };
}
