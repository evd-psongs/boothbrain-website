import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { EventStagedInventoryItem } from '@/types/inventory';

type EventStagedInventoryRow = {
  id: string;
  owner_user_id: string;
  event_id: string;
  name: string;
  sku: string | null;
  price_cents: number | null;
  quantity: number | null;
  low_stock_threshold: number | null;
  image_paths: string[] | null;
  expected_release_at: string | null;
  status: 'staged' | 'released' | 'converted';
  notes: string | null;
  converted_item_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const mapRow = (row: EventStagedInventoryRow): EventStagedInventoryItem => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  eventId: row.event_id,
  name: row.name,
  sku: row.sku,
  priceCents: row.price_cents ?? 0,
  quantity: row.quantity ?? 0,
  lowStockThreshold: row.low_stock_threshold ?? 0,
  imagePaths: Array.isArray(row.image_paths) ? row.image_paths : [],
  expectedReleaseAt: row.expected_release_at,
  status: row.status,
  notes: row.notes,
  convertedItemId: row.converted_item_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function useEventStagedInventory(userId: string | null | undefined) {
  const [items, setItems] = useState<EventStagedInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchItems = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) {
        setItems([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const query = supabase
        .from('event_staged_inventory')
        .select(
          'id, owner_user_id, event_id, name, sku, price_cents, quantity, low_stock_threshold, image_paths, expected_release_at, status, notes, converted_item_id, created_at, updated_at',
        )
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true });

      const { data, error: queryError } = await query;

      if (signal?.aborted) return;

      if (queryError) {
        setError(queryError.message ?? 'Failed to load staged inventory.');
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as EventStagedInventoryRow[];
      setItems(rows.map(mapRow));
      setLoading(false);
    },
    [userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchItems(controller.signal);
    return () => controller.abort();
  }, [fetchItems]);

  useEffect(() => {
    if (!userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`event_staged_inventory:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_staged_inventory',
          filter: `owner_user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<EventStagedInventoryRow>) => {
          setItems((current) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              return [...current, mapRow(payload.new)];
            }
            if (payload.eventType === 'UPDATE' && payload.new) {
              return current.map((item) =>
                item.id === payload.new.id ? mapRow(payload.new) : item,
              );
            }
            if (payload.eventType === 'DELETE' && payload.old) {
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
  }, [userId]);

  const itemsByEvent = useMemo(() => {
    return items.reduce<Record<string, EventStagedInventoryItem[]>>((acc, item) => {
      if (!acc[item.eventId]) {
        acc[item.eventId] = [];
      }
      acc[item.eventId].push(item);
      return acc;
    }, {});
  }, [items]);

  const stagedItems = useMemo(
    () => items.filter((item) => item.status === 'staged'),
    [items],
  );

  const stagedByEvent = useMemo(() => {
    return stagedItems.reduce<Record<string, EventStagedInventoryItem[]>>((acc, item) => {
      if (!acc[item.eventId]) {
        acc[item.eventId] = [];
      }
      acc[item.eventId].push(item);
      return acc;
    }, {});
  }, [stagedItems]);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
    itemsByEvent,
    stagedItems,
    stagedByEvent,
  };
}
