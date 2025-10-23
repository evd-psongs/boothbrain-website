import { supabase } from '@/lib/supabase';
import { createInventoryItem } from '@/lib/inventory';
import type {
  EventStagedInventoryItem,
  EventStagedInventoryStatus,
  InventoryItem,
} from '@/types/inventory';

export type EventStagedInventoryInput = {
  name: string;
  sku: string | null;
  priceCents: number;
  quantity: number;
  lowStockThreshold: number;
  imagePaths?: string[];
  expectedReleaseAt?: string | null;
  notes?: string | null;
};

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
  status: EventStagedInventoryStatus;
  notes: string | null;
  converted_item_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUMNS =
  'id, owner_user_id, event_id, name, sku, price_cents, quantity, low_stock_threshold, image_paths, expected_release_at, status, notes, converted_item_id, created_at, updated_at';

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

export async function listEventStagedInventory({
  userId,
  eventId,
  status,
}: {
  userId: string;
  eventId?: string;
  status?: EventStagedInventoryStatus | EventStagedInventoryStatus[];
}): Promise<EventStagedInventoryItem[]> {
  let query = supabase
    .from('event_staged_inventory')
    .select(SELECT_COLUMNS)
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRow(row as EventStagedInventoryRow));
}

export async function getEventStagedInventoryItem({
  userId,
  stagedId,
}: {
  userId: string;
  stagedId: string;
}): Promise<EventStagedInventoryItem | null> {
  const { data, error } = await supabase
    .from('event_staged_inventory')
    .select(SELECT_COLUMNS)
    .eq('owner_user_id', userId)
    .eq('id', stagedId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRow(data as EventStagedInventoryRow);
}

export async function createEventStagedInventoryItem({
  userId,
  eventId,
  input,
}: {
  userId: string;
  eventId: string;
  input: EventStagedInventoryInput;
}): Promise<EventStagedInventoryItem> {
  const payload = {
    owner_user_id: userId,
    event_id: eventId,
    name: input.name,
    sku: input.sku,
    price_cents: input.priceCents,
    quantity: input.quantity,
    low_stock_threshold: input.lowStockThreshold,
    image_paths: input.imagePaths ?? [],
    expected_release_at: input.expectedReleaseAt ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('event_staged_inventory')
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create staged inventory record.');
  }

  return mapRow(data as EventStagedInventoryRow);
}

export async function updateEventStagedInventoryItem({
  userId,
  stagedId,
  input,
}: {
  userId: string;
  stagedId: string;
  input: EventStagedInventoryInput;
}): Promise<EventStagedInventoryItem | null> {
  const payload = {
    name: input.name,
    sku: input.sku,
    price_cents: input.priceCents,
    quantity: input.quantity,
    low_stock_threshold: input.lowStockThreshold,
    image_paths: input.imagePaths ?? [],
    expected_release_at: input.expectedReleaseAt ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('event_staged_inventory')
    .update(payload)
    .eq('id', stagedId)
    .eq('owner_user_id', userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRow(data as EventStagedInventoryRow);
}

export async function updateEventStagedInventoryStatus({
  userId,
  stagedId,
  status,
  convertedItemId,
}: {
  userId: string;
  stagedId: string;
  status: EventStagedInventoryStatus;
  convertedItemId?: string | null;
}): Promise<EventStagedInventoryItem | null> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (convertedItemId !== undefined) {
    payload.converted_item_id = convertedItemId;
  }

  const { data, error } = await supabase
    .from('event_staged_inventory')
    .update(payload)
    .eq('id', stagedId)
    .eq('owner_user_id', userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRow(data as EventStagedInventoryRow);
}

export async function deleteEventStagedInventoryItem({
  userId,
  stagedId,
}: {
  userId: string;
  stagedId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('event_staged_inventory')
    .delete()
    .eq('id', stagedId)
    .eq('owner_user_id', userId);

  if (error) {
    throw error;
  }
}

export async function loadStagedInventoryItems({
  userId,
  eventId,
  items,
}: {
  userId: string;
  eventId: string;
  items: EventStagedInventoryItem[];
}): Promise<InventoryItem[]> {
  const results: InventoryItem[] = [];

  for (const staged of items) {
    const created = await createInventoryItem({
      userId,
      input: {
        name: staged.name,
        sku: staged.sku ?? null,
        priceCents: staged.priceCents ?? 0,
        quantity: staged.quantity ?? 0,
        lowStockThreshold: staged.lowStockThreshold ?? 0,
        sessionId: eventId,
        imagePaths: staged.imagePaths ?? [],
      },
    });

    await updateEventStagedInventoryStatus({
      userId,
      stagedId: staged.id,
      status: 'converted',
      convertedItemId: created.id,
    });

    results.push(created);
  }

  return results;
}
