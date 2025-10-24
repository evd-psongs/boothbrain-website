import { supabase } from '@/lib/supabase';

export const FREE_PLAN_ITEM_LIMIT = 5;

type InventoryRow = {
  id: string;
  updated_at: string | null;
  created_at: string | null;
};

type EnforcementResult = {
  keptInventory: number;
  removedInventory: number;
  keptStaged: number;
  removedStaged: number;
};

const orderByRecency = ['updated_at', 'created_at'] as const;

export async function enforceFreePlanLimits(userId: string): Promise<EnforcementResult> {
  const limit = FREE_PLAN_ITEM_LIMIT;

  const { data: inventoryData, error: inventoryError } = await supabase
    .from('items')
    .select('id, updated_at, created_at')
    .eq('owner_user_id', userId)
    .order(orderByRecency[0], { ascending: false, nullsFirst: false })
    .order(orderByRecency[1], { ascending: false, nullsFirst: false });

  if (inventoryError) {
    throw new Error(inventoryError.message ?? 'Failed to load inventory for pause downgrade.');
  }

  const inventoryRows = (inventoryData ?? []) as InventoryRow[];
  const inventoryToKeep = inventoryRows.slice(0, limit);
  const inventoryToRemove = inventoryRows.slice(limit);

  if (inventoryToRemove.length) {
    const { error: deleteInventoryError } = await supabase
      .from('items')
      .delete()
      .in(
        'id',
        inventoryToRemove.map((row) => row.id),
      );

    if (deleteInventoryError) {
      throw new Error(deleteInventoryError.message ?? 'Failed to prune inventory while downgrading.');
    }
  }

  const remainingSlots = Math.max(0, limit - inventoryToKeep.length);

  const { data: stagedData, error: stagedError } = await supabase
    .from('event_staged_inventory')
    .select('id, updated_at, created_at')
    .eq('owner_user_id', userId)
    .order(orderByRecency[0], { ascending: false, nullsFirst: false })
    .order(orderByRecency[1], { ascending: false, nullsFirst: false });

  if (stagedError) {
    throw new Error(stagedError.message ?? 'Failed to load staged inventory for pause downgrade.');
  }

  const stagedRows = (stagedData ?? []) as InventoryRow[];
  const stagedToKeep = stagedRows.slice(0, remainingSlots);
  const stagedToRemove = stagedRows.slice(remainingSlots);

  if (stagedToRemove.length) {
    const { error: deleteStagedError } = await supabase
      .from('event_staged_inventory')
      .delete()
      .in(
        'id',
        stagedToRemove.map((row) => row.id),
      );

    if (deleteStagedError) {
      throw new Error(deleteStagedError.message ?? 'Failed to prune staged inventory while downgrading.');
    }
  }

  return {
    keptInventory: inventoryToKeep.length,
    removedInventory: inventoryToRemove.length,
    keptStaged: stagedToKeep.length,
    removedStaged: stagedToRemove.length,
  };
}
