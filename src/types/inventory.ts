export type InventoryItem = {
  id: string;
  ownerUserId: string;
  sessionId: string | null;
  name: string;
  sku: string | null;
  priceCents: number;
  quantity: number;
  lowStockThreshold: number;
  imagePaths: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type EventStagedInventoryStatus = 'staged' | 'released' | 'converted';

export type EventStagedInventoryItem = {
  id: string;
  ownerUserId: string;
  eventId: string;
  name: string;
  sku: string | null;
  priceCents: number;
  quantity: number;
  lowStockThreshold: number;
  imagePaths: string[];
  expectedReleaseAt: string | null;
  status: EventStagedInventoryStatus;
  notes: string | null;
  convertedItemId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
