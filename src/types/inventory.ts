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
