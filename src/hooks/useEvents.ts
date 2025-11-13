import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { EventRecord } from '@/types/events';
import type { EventRow } from '@/types/database';
import { listEvents } from '@/lib/events';

const mapRow = (row: EventRow): EventRecord => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  name: row.name,
  startDateISO: row.start_date,
  endDateISO: row.end_date,
  location: row.location ?? null,
  notes: row.notes ?? null,
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

export function useEvents(ownerUserId: string | null | undefined) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetch = useCallback(async () => {
    if (!ownerUserId) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listEvents(ownerUserId);
      setEvents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (!ownerUserId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`events:${ownerUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          table: 'events',
          schema: 'public',
          filter: `owner_user_id=eq.${ownerUserId}`,
        },
        (payload: RealtimePostgresChangesPayload<EventRow>) => {
          setEvents((current) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              return [...current, mapRow(payload.new)].sort((a, b) =>
                new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime(),
              );
            }
            if (payload.eventType === 'UPDATE' && payload.new) {
              return current
                .map((event) => (event.id === payload.new.id ? mapRow(payload.new) : event))
                .sort((a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime());
            }
            if (payload.eventType === 'DELETE' && payload.old) {
              return current.filter((event) => event.id !== payload.old.id);
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
  }, [ownerUserId]);

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime());
  }, [events]);

  return {
    events: sorted,
    rawEvents: events,
    loading,
    error,
    refresh: fetch,
    setEvents,
  };
}
