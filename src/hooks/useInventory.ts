import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';

type InventoryRow = {
  id: string;
  owner_user_id: string;
  event_id: string | null;
  name: string;
  sku: string | null;
  price_cents: number | null;
  quantity: number | null;
  low_stock_threshold: number | null;
  image_paths: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const mapRow = (row: InventoryRow): InventoryItem => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  sessionId: row.event_id,
  name: row.name,
  sku: row.sku,
  priceCents: row.price_cents ?? 0,
  quantity: row.quantity ?? 0,
  lowStockThreshold: row.low_stock_threshold ?? 0,
  imagePaths: Array.isArray(row.image_paths) ? row.image_paths : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function useInventory(ownerId: string | null | undefined) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchItems = useCallback(
    async (signal?: AbortSignal) => {
      if (!ownerId) {
        setItems([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const query = supabase
        .from('items')
        .select(
          'id, owner_user_id, event_id, name, sku, price_cents, quantity, low_stock_threshold, image_paths, created_at, updated_at',
        )
        .eq('owner_user_id', ownerId)
        .order('name', { ascending: true });

      const { data, error: queryError } = await query;

      if (signal?.aborted) return;

      if (queryError) {
        setError(queryError.message ?? 'Failed to load inventory.');
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as InventoryRow[];
      setItems(rows.map(mapRow));
      setLoading(false);
    },
    [ownerId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchItems(controller.signal);
    return () => controller.abort();
  }, [fetchItems]);

  useEffect(() => {
    if (!ownerId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`inventory:${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `owner_user_id=eq.${ownerId}`,
        },
        (payload: RealtimePostgresChangesPayload<InventoryRow>) => {
          setItems((current) => {
            if (payload.eventType === 'INSERT') {
              return [...current, mapRow(payload.new)];
            }
            if (payload.eventType === 'UPDATE') {
              return current.map((item) => (item.id === payload.new.id ? mapRow(payload.new) : item));
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((item) => item.id !== payload.old?.id);
            }
            return current;
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [ownerId]);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
  };
}
