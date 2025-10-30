import { useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { formatCurrencyFromCents } from '@/utils/currency';
import { formatTimestamp } from '@/utils/dates';
import { formatPaymentLabel } from '@/utils/payment';
import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { useOrderReports } from '@/hooks/useOrderReports';

function formatCsvValue(input: string | number | null | undefined): string {
  const raw = input ?? '';
  const str = typeof raw === 'string' ? raw : String(raw);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function ReportsScreen() {
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession } = useSession();

  const userId = user?.id ?? null;

  const { orders, loading, error, refresh } = useOrderReports(userId, currentSession?.eventId ?? null);

  const totalRevenueCents = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalCents, 0),
    [orders],
  );

  const totalItemsSold = useMemo(
    () => orders.reduce((sum, order) => sum + (order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0), 0),
    [orders],
  );

  const handleExport = useCallback(async () => {
    if (!orders.length) {
      await Share.share({ message: 'No sales data available yet.' });
      return;
    }

    const header = [
      'Order ID',
      'Sold At',
      'Payment Method',
      'Seller Device',
      'Item Name',
      'Quantity',
      'Line Total',
    ];

    const rows: string[] = [];
    rows.push(header.map(formatCsvValue).join(','));

    orders.forEach((order) => {
      const soldAt = formatTimestamp(order.createdAt);
      const payment = formatPaymentLabel(order.paymentMethod);
      const seller = order.deviceId ?? '—';

      const items = order.items?.length ? order.items : [{
        orderId: order.id,
        itemId: null,
        quantity: 0,
        priceCents: order.totalCents,
        itemName: order.description ?? 'Order total',
        itemSku: null,
      }];

      items.forEach((item) => {
        const lineTotal = item.quantity > 0 ? item.quantity * item.priceCents : item.priceCents;
        const row = [
          order.id,
          soldAt,
          payment,
          seller,
          item.itemName ?? 'Unknown item',
          item.quantity,
          formatCurrencyFromCents(lineTotal, 'USD'),
        ];
        rows.push(row.map(formatCsvValue).join(','));
      });
    });

    const csv = rows.join('\n');

    try {
      await Share.share({
        title: 'BoothBrain Sales Report',
        message: csv,
      });
    } catch (shareError) {
      console.warn('Failed to share report', shareError);
    }
  }, [orders]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Sales Report</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Who sold what and when.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.exportButton,
              {
                borderColor: theme.colors.primary,
                backgroundColor: pressed ? theme.colors.primary : 'transparent',
              },
            ]}
            onPress={handleExport}
          >
            <Feather
              name="download"
              size={16}
              color={theme.colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.exportButtonText, { color: theme.colors.primary }]}>Export CSV</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={[styles.alert, { borderColor: theme.colors.error, backgroundColor: 'rgba(243, 105, 110, 0.12)' }]}>
            <Feather name="alert-circle" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.alertText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                void refresh();
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          <View style={styles.summaryRowContainer}>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Total revenue</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
                {formatCurrencyFromCents(totalRevenueCents, 'USD')}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Orders</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{orders.length}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Items sold</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{totalItemsSold}</Text>
            </View>
          </View>

          {loading && !orders.length ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Loading sales…</Text>
            </View>
          ) : null}

          {!loading && !orders.length ? (
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={28} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No sales yet</Text>
              <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>Complete a sale to see it here.</Text>
            </View>
          ) : null}

          {orders.map((order) => (
            <View key={order.id} style={[styles.orderCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <View style={styles.orderHeader}>
                <Text style={[styles.orderTotal, { color: theme.colors.textPrimary }]}>
                  {formatCurrencyFromCents(order.totalCents, 'USD')}
                </Text>
                <Text style={{ color: theme.colors.textSecondary }}>{formatTimestamp(order.createdAt)}</Text>
              </View>
              <View style={styles.orderMetaRow}>
                <View style={styles.metaItem}>
                  <Feather name="credit-card" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={[styles.metaText, { color: theme.colors.textPrimary }]}>{formatPaymentLabel(order.paymentMethod)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="smartphone" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{order.deviceId ?? 'Single device'}</Text>
                </View>
              </View>

              <View style={styles.itemList}>
                {(order.items?.length ? order.items : []).map((item) => (
                  <View key={`${order.id}-${item.itemId ?? item.itemName}`} style={styles.itemRow}>
                    <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>
                      {item.itemName ?? 'Unknown item'}
                    </Text>
                    <View style={styles.itemQuantityGroup}>
                      <Text style={[styles.itemQuantity, { color: theme.colors.textSecondary }]}>× {item.quantity}</Text>
                      <Text style={[styles.itemTotal, { color: theme.colors.textPrimary }]}>
                        {formatCurrencyFromCents(item.quantity * item.priceCents, 'USD')}
                      </Text>
                    </View>
                  </View>
                ))}
                {!order.items?.length ? (
                  <Text style={{ color: theme.colors.textSecondary }}>
                    No item detail recorded. Order total shown above.
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  alert: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 16,
  },
  summaryRowContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
  orderMetaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  itemQuantityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 13,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
});
