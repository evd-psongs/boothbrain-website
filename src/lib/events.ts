import { supabase } from '@/lib/supabase';
import type { EventRecord, EventChecklistItem } from '@/types/events';
import type { EventRow } from '@/types/database';

const toEvent = (row: EventRow): EventRecord => ({
  id: row.id as string,
  ownerUserId: row.owner_user_id as string,
  name: row.name as string,
  startDateISO: row.start_date,
  endDateISO: row.end_date,
  location: row.location ?? null,
  notes: row.notes ?? null,
  checklist: Array.isArray(row.checklist)
    ? (row.checklist as EventChecklistItem[])
    : [],
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const fromEventInput = (ownerUserId: string, event: Omit<EventRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>) => ({
  owner_user_id: ownerUserId,
  name: event.name,
  start_date: event.startDateISO,
  end_date: event.endDateISO,
  location: event.location ?? null,
  notes: event.notes ?? null,
  checklist: event.checklist ?? [],
});

export async function listEvents(ownerUserId: string): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, owner_user_id, name, start_date, end_date, location, notes, checklist, created_at, updated_at')
    .eq('owner_user_id', ownerUserId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toEvent);
}

export async function createEvent(ownerUserId: string, event: Omit<EventRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>): Promise<EventRecord> {
    const { data, error } = await supabase
      .from('events')
      .insert(fromEventInput(ownerUserId, event))
      .select('id, owner_user_id, name, start_date, end_date, location, notes, checklist, created_at, updated_at')
      .single();
    if (error || !data) throw error ?? new Error('Failed to create event.');
    return toEvent(data);
}

export async function updateEventRecord(ownerUserId: string, eventId: string, updates: Partial<Omit<EventRecord, 'id' | 'ownerUserId'>>): Promise<EventRecord | null> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.startDateISO !== undefined) payload.start_date = updates.startDateISO;
  if (updates.endDateISO !== undefined) payload.end_date = updates.endDateISO;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.checklist !== undefined) payload.checklist = updates.checklist;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .eq('owner_user_id', ownerUserId)
    .select('id, owner_user_id, name, start_date, end_date, location, notes, checklist, created_at, updated_at')
    .maybeSingle();

  if (error) throw error;
  return data ? toEvent(data) : null;
}

export async function deleteEventRecord(ownerUserId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('owner_user_id', ownerUserId);
  if (error) throw error;
}
