import { useCallback, useEffect, useState } from 'react';

import { fetchOrders } from '@/lib/orders';
import type { Order } from '@/types/orders';

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
      } catch (err: any) {
        if (!options?.signal?.aborted) {
          setError(err?.message ?? 'Failed to load orders.');
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
