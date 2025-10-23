import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UpcomingEvent = {
  id: string;
  name: string;
  startDateISO: string;
  endDateISO: string;
  location?: string | null;
  notes?: string | null;
  checklist?: EventChecklistItem[];
};

export type EventChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

const STORAGE_KEY = (userId: string) => `home_upcoming_events_${userId}`;

export function useUpcomingEvents(userId: string | null | undefined) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY(userId));
      if (!raw) {
        setEvents([]);
      } else {
        const parsed = JSON.parse(raw) as (UpcomingEvent & { dateISO?: string })[];
        if (Array.isArray(parsed)) {
          setEvents(
            parsed.map((event) => {
              if (event.startDateISO && event.endDateISO) {
                return event;
              }
              const legacyDate = (event as { dateISO?: string | null | undefined }).dateISO;
              const fallback = legacyDate ?? new Date().toISOString();
              return {
                ...event,
                startDateISO: fallback,
                endDateISO: fallback,
              };
            }),
          );
        } else {
          setEvents([]);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load events.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const persistEvents = useCallback(
    async (payload: UpcomingEvent[]) => {
      if (!userId) return;
      try {
        await AsyncStorage.setItem(STORAGE_KEY(userId), JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to persist upcoming events', err);
      }
    },
    [userId],
  );

  const addEvent = useCallback(
    async (event: UpcomingEvent) => {
      setEvents((prev) => {
        const next = [...prev, event];
        void persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const updateEvent = useCallback(
    async (eventId: string, updater: (event: UpcomingEvent) => UpcomingEvent) => {
      setEvents((prev) => {
        const next = prev.map((event) => (event.id === eventId ? updater(event) : event));
        void persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const removeEvent = useCallback(
    async (eventId: string) => {
      setEvents((prev) => {
        const next = prev.filter((event) => event.id !== eventId);
        void persistEvents(next);
        return next;
      });
    },
    [persistEvents],
  );

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime = new Date(a.startDateISO).getTime();
      const bTime = new Date(b.startDateISO).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });
  }, [events]);

  return {
    events: sortedEvents,
    rawEvents: events,
    loading,
    error,
    refresh: loadEvents,
    addEvent,
    updateEvent,
    removeEvent,
  };
}
