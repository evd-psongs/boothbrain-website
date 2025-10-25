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

const getRecencyScore = (row: InventoryRow): number => {
  const timestamps = [row.updated_at, row.created_at].filter((value): value is string => Boolean(value));
  if (!timestamps.length) return 0;

  const parsed = timestamps
    .map((value) => {
      const result = Date.parse(value);
      return Number.isNaN(result) ? null : result;
    })
    .filter((value): value is number => value !== null);

  if (!parsed.length) return 0;
  return Math.max(...parsed);
};

const sortByRecencyDesc = (rows: InventoryRow[]): InventoryRow[] =>
  [...rows].sort((a, b) => {
    const aScore = getRecencyScore(a);
    const bScore = getRecencyScore(b);
    if (aScore === bScore) {
      return (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id);
    }
    return bScore - aScore;
  });

export async function enforceFreePlanLimits(userId: string): Promise<EnforcementResult> {
  const limit = FREE_PLAN_ITEM_LIMIT;

  const { data: inventoryData, error: inventoryError } = await supabase
    .from('items')
    .select('id, updated_at, created_at')
    .eq('owner_user_id', userId);

  if (inventoryError) {
    throw new Error(inventoryError.message ?? 'Failed to load inventory for pause downgrade.');
  }

  const inventoryRows = sortByRecencyDesc((inventoryData ?? []) as InventoryRow[]);
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
    .eq('owner_user_id', userId);

  if (stagedError) {
    throw new Error(stagedError.message ?? 'Failed to load staged inventory for pause downgrade.');
  }

  const stagedRows = sortByRecencyDesc((stagedData ?? []) as InventoryRow[]);
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
