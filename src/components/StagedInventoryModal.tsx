import { memo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/providers/ThemeProvider';
import { formatCurrencyFromCents } from '@/utils/currency';

export type StagedInventoryModalItem = {
  id: string;
  name: string;
  quantity: number;
  priceCents?: number | null;
};

type StagedInventoryModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  items: StagedInventoryModalItem[];
  loading?: boolean;
  emptyMessage?: string;
  onClose: () => void;
  onLoadAll?: () => void;
  onEdit?: (itemId: string) => void;
  onRelease?: (itemId: string) => void;
  onRemove?: (itemId: string) => void;
  loadAllLabel?: string;
  releaseLabel?: string;
  removeLabel?: string;
};

function StagedInventoryModalComponent({
  visible,
  title,
  subtitle,
  items,
  loading,
  emptyMessage = 'No staged inventory yet.',
  onClose,
  onLoadAll,
  onEdit,
  onRelease,
  onRemove,
  loadAllLabel = 'Load all',
  releaseLabel = 'Release',
  removeLabel = 'Remove',
}: StagedInventoryModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>Loading…</Text>
            </View>
          ) : items.length ? (
            <>
              {onLoadAll ? (
                <Pressable
                  onPress={onLoadAll}
                  style={({ pressed }) => [
                    styles.bulkLoadButton,
                    {
                      borderColor: theme.colors.primary,
                      backgroundColor: pressed
                        ? 'rgba(101, 88, 245, 0.16)'
                        : 'rgba(101, 88, 245, 0.12)',
                    },
                  ]}
                >
                  <Feather name="log-in" size={16} color={theme.colors.primary} />
                  <Text style={[styles.bulkLoadLabel, { color: theme.colors.primary }]}>{loadAllLabel}</Text>
                </Pressable>
              ) : null}

              <ScrollView
                style={styles.list}
                contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              >
                {items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                    <View style={styles.metaRow}>
                      <Text style={{ color: theme.colors.textSecondary }}>Qty {item.quantity}</Text>
                      {typeof item.priceCents === 'number' ? (
                        <Text style={{ color: theme.colors.textSecondary }}>
                          {formatCurrencyFromCents(item.priceCents, 'USD')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.actions}>
                    {onEdit ? (
                      <Pressable
                        onPress={() => onEdit(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            borderColor: theme.colors.textSecondary,
                            backgroundColor: pressed
                              ? 'rgba(139, 149, 174, 0.16)'
                              : 'rgba(139, 149, 174, 0.12)',
                          },
                        ]}
                      >
                        <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
                        <Text style={[styles.actionLabel, { color: theme.colors.textSecondary }]}>Edit</Text>
                      </Pressable>
                    ) : null}
                    {onRelease ? (
                      <Pressable
                        onPress={() => onRelease(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            borderColor: theme.colors.success,
                            backgroundColor: pressed ? 'rgba(45, 186, 127, 0.16)' : 'rgba(45, 186, 127, 0.12)',
                          },
                        ]}
                      >
                        <Feather name="check-circle" size={14} color={theme.colors.success} />
                        <Text style={[styles.actionLabel, { color: theme.colors.success }]}>{releaseLabel}</Text>
                      </Pressable>
                    ) : null}
                    {onRemove ? (
                      <Pressable
                        onPress={() => onRemove(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            borderColor: theme.colors.error,
                            backgroundColor: pressed
                              ? 'rgba(243, 105, 110, 0.16)'
                              : 'rgba(243, 105, 110, 0.12)',
                          },
                        ]}
                      >
                        <Feather name="trash-2" size={14} color={theme.colors.error} />
                        <Text style={[styles.actionLabel, { color: theme.colors.error }]}>{removeLabel}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={24} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                {emptyMessage}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const StagedInventoryModal = memo(StagedInventoryModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 13, 30, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    padding: 20,
    elevation: 12,
    shadowColor: '#060916',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    maxHeight: '85%',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  list: {
    maxHeight: 380,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    flexDirection: 'row',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'flex-start',
    justifyContent: 'flex-end',
  },
  bulkLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  bulkLoadLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StagedInventoryModal;
