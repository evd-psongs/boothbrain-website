export const ORDER_STATUSES = ['pending', 'paid', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'square', 'stripe', 'venmo', 'cash_app', 'paypal'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OrderItemSummary = {
  orderId: string;
  itemId: string | null;
  quantity: number;
  priceCents: number;
  itemName: string | null;
  itemSku: string | null;
};

export type Order = {
  id: string;
  ownerUserId: string;
  sessionId: string | null;
  status: OrderStatus;
  paymentMethod: string;
  totalCents: number;
  taxCents: number;
  taxRateBps: number | null;
  buyerName: string | null;
  buyerContact: string | null;
  description: string | null;
  depositTaken: boolean;
  deviceId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items?: OrderItemSummary[];
};
