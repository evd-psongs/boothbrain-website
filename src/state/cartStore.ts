import { create } from 'zustand';

import type { InventoryItem } from '@/types/inventory';

export type CartLine = {
  item: InventoryItem;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  addItem: (item: InventoryItem) => boolean;
  setItemQuantity: (item: InventoryItem, quantity: number) => boolean;
  updateLine: (itemId: string, quantity: number) => void;
  removeLine: (itemId: string) => void;
  clear: () => void;
  totalCount: () => number;
  totalCents: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  addItem: (item) => {
    const existing = get().lines.find((line) => line.item.id === item.id);
    const maxQuantity = Math.max(0, item.quantity);

    if (existing) {
      if (existing.quantity >= maxQuantity && maxQuantity !== 0) {
        return false;
      }
      const nextQuantity = maxQuantity === 0 ? existing.quantity + 1 : Math.min(existing.quantity + 1, maxQuantity);
      set({
        lines: get().lines.map((line) =>
          line.item.id === item.id ? { ...line, quantity: nextQuantity } : line,
        ),
      });
      return true;
    }

    if (maxQuantity <= 0) {
      return false;
    }

    set({ lines: [...get().lines, { item, quantity: 1 }] });
    return true;
  },
  setItemQuantity: (item, quantity) => {
    const maxQuantity = Math.max(0, item.quantity);
    if (quantity > maxQuantity) {
      return false;
    }

    if (quantity <= 0) {
      set({ lines: get().lines.filter((line) => line.item.id !== item.id) });
      return true;
    }

    const existing = get().lines.find((line) => line.item.id === item.id);
    if (existing) {
      set({
        lines: get().lines.map((line) =>
          line.item.id === item.id ? { ...line, quantity } : line,
        ),
      });
      return true;
    }

    set({ lines: [...get().lines, { item, quantity }] });
    return true;
  },
  updateLine: (itemId, quantity) => {
    const line = get().lines.find((entry) => entry.item.id === itemId);
    if (!line) return;
    get().setItemQuantity(line.item, quantity);
  },
  removeLine: (itemId) => {
    set({ lines: get().lines.filter((line) => line.item.id !== itemId) });
  },
  clear: () => set({ lines: [] }),
  totalCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),
  totalCents: () =>
    get().lines.reduce((sum, line) => sum + line.quantity * (line.item.priceCents ?? 0), 0),
}));
