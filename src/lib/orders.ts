import { supabase } from '@/lib/supabase';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/types/orders';

type OrderRow = {
  id: string;
  owner_user_id: string | null;
  status: string | null;
  payment_method: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  tax_rate_bps: number | null;
  event_id: string | null;
  buyer_name: string | null;
  buyer_contact: string | null;
  description: string | null;
  deposit_taken: boolean | null;
  device_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const mapRowToOrder = (row: OrderRow): Order => ({
  id: row.id,
  ownerUserId: row.owner_user_id ?? '',
  sessionId: row.event_id,
  status: ORDER_STATUSES.includes((row.status as OrderStatus) ?? 'pending')
    ? ((row.status as OrderStatus) ?? 'pending')
    : 'pending',
  paymentMethod: row.payment_method ?? 'cash',
  totalCents: typeof row.total_cents === 'number' ? row.total_cents : 0,
  taxCents: typeof row.tax_cents === 'number' ? row.tax_cents : 0,
  taxRateBps: typeof row.tax_rate_bps === 'number' ? row.tax_rate_bps : null,
  buyerName: row.buyer_name,
  buyerContact: row.buyer_contact,
  description: row.description,
  depositTaken: Boolean(row.deposit_taken),
  deviceId: row.device_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type FetchOrdersInput = {
  userId: string;
  sessionId?: string | null;
};

export async function fetchOrders({ userId, sessionId = null }: FetchOrdersInput): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select(
      'id, owner_user_id, status, payment_method, total_cents, tax_cents, tax_rate_bps, event_id, buyer_name, buyer_contact, description, deposit_taken, device_id, created_at, updated_at',
    )
    .eq('owner_user_id', userId);

  if (sessionId) {
    query = query.eq('event_id', sessionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrderRow[]).map(mapRowToOrder);
}

type InventoryAdjustment = 'increment' | 'decrement';

const adjustInventoryForOrder = async ({
  userId,
  orderId,
  adjustment,
}: {
  userId: string;
  orderId: string;
  adjustment: InventoryAdjustment;
}) => {
  const multiplier = adjustment === 'decrement' ? -1 : 1;

  const { data: orderExists, error: lookupError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (lookupError || !orderExists) {
    console.warn('Order not found for inventory adjustment', orderId, lookupError);
    return;
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from('order_items')
    .select('item_id, quantity')
    .eq('order_id', orderId);

  if (orderItemsError) {
    console.warn('Failed to fetch order items for adjustment', orderId, orderItemsError);
    return;
  }

  for (const line of (orderItems ?? []) as { item_id: string | null; quantity: number | null }[]) {
    if (!line.item_id) continue;

    const { data: currentItem, error: fetchItemError } = await supabase
      .from('items')
      .select('quantity')
      .eq('id', line.item_id)
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (fetchItemError || !currentItem) {
      console.warn('Failed to fetch inventory item during adjustment', line.item_id, fetchItemError);
      continue;
    }

    const currentQuantity = typeof currentItem.quantity === 'number' ? currentItem.quantity : 0;
    const delta = (typeof line.quantity === 'number' ? line.quantity : 0) * multiplier;
    const nextQuantity = Math.max(currentQuantity + delta, 0);

    const { error: updateError } = await supabase
      .from('items')
      .update({
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.item_id)
      .eq('owner_user_id', userId);

    if (updateError) {
      console.warn('Failed to update inventory quantity during adjustment', line.item_id, updateError);
    }
  }
};

export async function updateOrderStatus({
  userId,
  orderId,
  status,
}: {
  userId: string;
  orderId: string;
  status: OrderStatus;
}): Promise<void> {
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error(`Invalid order status: ${status}`);
  }

  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingOrder) {
    throw new Error('Order not found');
  }

  const previousStatus = (existingOrder.status as OrderStatus | null) ?? 'pending';

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('owner_user_id', userId);

  if (updateError) {
    throw updateError;
  }

  if (status === 'cancelled' && previousStatus === 'paid') {
    await adjustInventoryForOrder({ userId, orderId, adjustment: 'increment' });
  } else if (status === 'paid' && previousStatus === 'pending') {
    await adjustInventoryForOrder({ userId, orderId, adjustment: 'decrement' });
  }
}
