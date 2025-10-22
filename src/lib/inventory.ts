import { supabase } from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';

export type InventoryInput = {
  name: string;
  sku: string | null;
  priceCents: number;
  quantity: number;
  lowStockThreshold: number;
  sessionId?: string | null;
  imagePaths?: string[];
};

const mapRowToItem = (row: any): InventoryItem => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  sessionId: row.event_id ?? null,
  name: row.name,
  sku: row.sku,
  priceCents: row.price_cents ?? 0,
  quantity: row.quantity ?? 0,
  lowStockThreshold: row.low_stock_threshold ?? 0,
  imagePaths: Array.isArray(row.image_paths) ? row.image_paths : [],
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

export async function createInventoryItem({
  userId,
  input,
}: {
  userId: string;
  input: InventoryInput;
}) {
  const payload = {
    owner_user_id: userId,
    event_id: input.sessionId ?? null,
    name: input.name,
    sku: input.sku,
    price_cents: input.priceCents,
    quantity: input.quantity,
    low_stock_threshold: input.lowStockThreshold,
    image_paths: input.imagePaths ?? [],
  };

  const { error } = await supabase.from('items').insert(payload);
  if (error) {
    throw error;
  }
}

export async function updateInventoryItem({
  userId,
  itemId,
  input,
}: {
  userId: string;
  itemId: string;
  input: InventoryInput;
}) {
  const payload = {
    event_id: input.sessionId ?? null,
    name: input.name,
    sku: input.sku,
    price_cents: input.priceCents,
    quantity: input.quantity,
    low_stock_threshold: input.lowStockThreshold,
    image_paths: input.imagePaths ?? [],
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('items')
    .update(payload)
    .eq('id', itemId)
    .eq('owner_user_id', userId);

  if (error) {
    throw error;
  }
}

export async function getInventoryItem({
  userId,
  itemId,
}: {
  userId: string;
  itemId: string;
}): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from('items')
    .select(
      'id, owner_user_id, event_id, name, sku, price_cents, quantity, low_stock_threshold, image_paths, created_at, updated_at',
    )
    .eq('owner_user_id', userId)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  return mapRowToItem(data);
}

export async function deleteInventoryItem({
  userId,
  itemId,
}: {
  userId: string;
  itemId: string;
}) {
  const { error } = await supabase.from('items').delete().eq('id', itemId).eq('owner_user_id', userId);
  if (error) {
    throw error;
  }
}
