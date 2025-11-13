import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { InventoryItem } from '@/types/inventory';

type InventoryListItemProps = {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
  themeColors: {
    border: string;
    textPrimary: string;
    textMuted: string;
    textSecondary: string;
    primary: string;
    warning: string;
    error: string;
  };
};

export function InventoryListItem({ item, onPress, themeColors }: InventoryListItemProps) {
  const isOutOfStock = item.quantity <= 0;
  const isLowStock = !isOutOfStock && item.quantity <= Math.max(item.lowStockThreshold, 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.itemCard, { borderColor: themeColors.border, opacity: pressed ? 0.85 : 1 }]}
      onPress={() => onPress(item)}
    >
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.sku ? (
            <Text style={[styles.itemSku, { color: themeColors.textMuted }]}>SKU {item.sku}</Text>
          ) : null}
        </View>
        <Text style={[styles.itemPrice, { color: themeColors.textPrimary }]}>
          ${(item.priceCents / 100).toFixed(2)}
        </Text>
      </View>

      <View style={styles.itemMeta}>
        <View style={styles.badge}>
          <Feather name="package" size={12} color={themeColors.primary} />
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>Qty {item.quantity}</Text>
        </View>
        <View style={styles.badge}>
          <Feather name="flag" size={12} color={themeColors.textSecondary} />
          <Text style={[styles.badgeText, { color: themeColors.textSecondary }]}>Low stock {item.lowStockThreshold}</Text>
        </View>
      </View>

      {isLowStock ? (
        <View style={[styles.statusPill, { backgroundColor: 'rgba(247, 181, 0, 0.16)' }]}>
          <Feather name="alert-triangle" size={12} color={themeColors.warning} />
          <Text style={[styles.statusText, { color: themeColors.warning }]}>Low stock</Text>
        </View>
      ) : null}

      {isOutOfStock ? (
        <View style={[styles.statusPill, { backgroundColor: 'rgba(243, 105, 110, 0.12)' }]}>
          <Feather name="x-octagon" size={12} color={themeColors.error} />
          <Text style={[styles.statusText, { color: themeColors.error }]}>Out of stock</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSku: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(101, 88, 245, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});