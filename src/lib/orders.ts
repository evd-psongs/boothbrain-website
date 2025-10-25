import { supabase } from '@/lib/supabase';
import {
  ORDER_STATUSES,
  type Order,
  type OrderItemSummary,
  type OrderStatus,
  type PaymentMethod,
} from '@/types/orders';

type OrderRow = {
  id: string;
  owner_user_id: string | null;
  session_id: string | null;
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

type OrderItemRow = {
  order_id: string | null;
  item_id: string | null;
  quantity: number | null;
  price_cents: number | null;
  items?:
    | {
        name: string | null;
        sku: string | null;
      }
    | {
        name: string | null;
        sku: string | null;
      }[]
    | null;
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

const mapOrderItems = (items: OrderItemRow[] | null | undefined): OrderItemSummary[] => {
  if (!items?.length) return [];
  return items.map((item) => ({
    orderId: item.order_id ?? '',
    itemId: item.item_id,
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    priceCents: typeof item.price_cents === 'number' ? item.price_cents : 0,
    itemName: Array.isArray(item.items)
      ? item.items[0]?.name ?? null
      : item.items?.name ?? null,
    itemSku: Array.isArray(item.items)
      ? item.items[0]?.sku ?? null
      : item.items?.sku ?? null,
  }));
};

type FetchOrdersInput = {
  userId: string;
  sessionId?: string | null;
};

type FetchOrderSummariesInput = FetchOrdersInput;

type CreateOrderItemInput = {
  itemId: string;
  quantity: number;
  priceCents: number;
};

type CreateOrderInput = {
  userId: string;
  sessionId?: string | null;
  sessionUuid?: string | null;
  paymentMethod: PaymentMethod;
  totalCents: number;
  taxCents?: number;
  taxRateBps?: number | null;
  description?: string | null;
  buyerName?: string | null;
  buyerContact?: string | null;
  depositTaken?: boolean;
  status?: OrderStatus;
  deviceId?: string | null;
  lines: CreateOrderItemInput[];
};

export async function fetchOrders({ userId, sessionId = null }: FetchOrdersInput): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select(
      'id, owner_user_id, session_id, status, payment_method, total_cents, tax_cents, tax_rate_bps, event_id, buyer_name, buyer_contact, description, deposit_taken, device_id, created_at, updated_at',
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

export async function fetchOrderSummaries({ userId, sessionId = null }: FetchOrderSummariesInput): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select(
      `id, owner_user_id, session_id, status, payment_method, total_cents, tax_cents, tax_rate_bps, event_id, buyer_name, buyer_contact, description, deposit_taken, device_id, created_at, updated_at,
      order_items(order_id, item_id, quantity, price_cents, items(name, sku))`,
    )
    .eq('owner_user_id', userId);

  query = query.eq('status', 'paid');

  if (sessionId) {
    query = query.eq('event_id', sessionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as (OrderRow & { order_items?: OrderItemRow[] })[]).map((row) => ({
    ...mapRowToOrder(row),
    items: mapOrderItems(row.order_items ?? []),
  }));
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

export async function createOrder({
  userId,
  sessionId = null,
  sessionUuid = null,
  paymentMethod,
  totalCents,
  taxCents = 0,
  taxRateBps = null,
  description = null,
  buyerName = null,
  buyerContact = null,
  depositTaken = false,
  status = 'paid',
  deviceId = null,
  lines,
}: CreateOrderInput): Promise<Order> {
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error(`Invalid order status: ${status}`);
  }

  if (!lines.length) {
    throw new Error('Cannot create an order without items.');
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      owner_user_id: userId,
      session_id: sessionUuid,
      event_id: sessionId,
      payment_method: paymentMethod,
      total_cents: totalCents,
      tax_cents: taxCents,
      tax_rate_bps: taxRateBps,
      status,
      buyer_name: buyerName,
      buyer_contact: buyerContact,
      description,
      deposit_taken: depositTaken,
      device_id: deviceId,
      created_by: userId,
    })
    .select(
      'id, owner_user_id, session_id, status, payment_method, total_cents, tax_cents, tax_rate_bps, event_id, buyer_name, buyer_contact, description, deposit_taken, device_id, created_at, updated_at',
    )
    .single();

  if (error) {
    throw error;
  }

  const orderRow = data as OrderRow;

  const orderItemsPayload = lines.map((line) => ({
    order_id: orderRow.id,
    item_id: line.itemId,
    quantity: line.quantity,
    price_cents: line.priceCents,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderRow.id).eq('owner_user_id', userId);
    throw itemsError;
  }

  if (status === 'paid') {
    await adjustInventoryForOrder({ userId, orderId: orderRow.id, adjustment: 'decrement' });
  }

  return mapRowToOrder(orderRow);
}

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
