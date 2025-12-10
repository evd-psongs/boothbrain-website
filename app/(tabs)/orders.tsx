import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { FeedbackBanner, type FeedbackState } from '@/components/common';
import { useOrders } from '@/hooks/useOrders';
import type { Order } from '@/types/orders';
import { updateOrderStatus } from '@/lib/orders';
import { formatCurrencyFromCents } from '@/utils/currency';
import { formatTimeAgo } from '@/utils/dates';
import { formatPaymentLabel, getPaymentVisuals } from '@/utils/payment';

export default function OrdersScreen() {
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession } = useSession();
  const userId = user?.id ?? null;
  const sessionId = currentSession?.eventId ?? null;

  const { orders, loading, error, refresh } = useOrders(userId, sessionId);

  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [markingOrderId, setMarkingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3200);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (error) {
      setFeedback({ type: 'error', message: error });
    }
  }, [error]);

  const paidOrders = useMemo(() => {
    return orders
      .filter((order) => order.status === 'paid')
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders
      .filter((order) => order.status === 'pending')
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [orders]);

  const totalCollectedCents = useMemo(
    () => paidOrders.reduce((sum, order) => sum + order.totalCents, 0),
    [paidOrders],
  );

  const handleRefresh = useCallback(async () => {
    if (!userId) {
      setFeedback({ type: 'info', message: 'Sign in to view orders.' });
      return;
    }
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh, userId]);

  const executeStatusUpdate = useCallback(
    async (
      orderId: string,
      status: 'paid' | 'cancelled',
      trackingState: Dispatch<SetStateAction<string | null>>,
    ) => {
      if (!userId) return;
      trackingState(orderId);
      try {
        await updateOrderStatus({ userId, orderId, status });
        setFeedback({
          type: status === 'paid' ? 'success' : 'info',
          message: status === 'paid' ? 'Marked as paid.' : 'Order updated.',
        });
        await refresh();
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err?.message ?? 'Failed to update order.',
        });
      } finally {
        trackingState(null);
      }
    },
    [refresh, userId],
  );

  const handleMarkAsPaid = useCallback(
    (order: Order) => {
      void executeStatusUpdate(order.id, 'paid', setMarkingOrderId);
    },
    [executeStatusUpdate],
  );

  const performCancel = useCallback(
    (order: Order) => {
      void executeStatusUpdate(order.id, 'cancelled', setCancellingOrderId);
    },
    [executeStatusUpdate],
  );

  const handleCancelOrder = useCallback(
    (order: Order) => {
      const isPaid = order.status === 'paid';
      Alert.alert(
        isPaid ? 'Void Payment' : 'Cancel Order',
        isPaid
          ? 'This will move the payment out of history and restore the order inventory. Continue?'
          : 'This will cancel the order so it no longer appears in your pending list. Continue?',
        [
          { text: 'Keep Order', style: 'cancel' },
          {
            text: isPaid ? 'Void Payment' : 'Cancel Order',
            style: 'destructive',
            onPress: () => performCancel(order),
          },
        ],
      );
    },
    [performCancel],
  );

  const renderPendingOrder = useCallback(
    (order: Order) => {
      const isMarking = markingOrderId === order.id;
      const isCancelling = cancellingOrderId === order.id;

      return (
        <View
          key={order.id}
          style={[
            styles.pendingCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: 'rgba(247, 181, 0, 0.35)',
            },
          ]}
        >
          <View style={styles.pendingHeader}>
            <View style={{ gap: 4 }}>
              <Text style={[styles.pendingAmount, { color: theme.colors.textPrimary }]}>
                {formatCurrencyFromCents(order.totalCents, 'USD')}
              </Text>
              <Text style={[styles.pendingMeta, { color: theme.colors.textMuted }]}>
                Waiting since {formatTimeAgo(order.createdAt)}
              </Text>
            </View>
            <View style={[styles.pendingIcon, { backgroundColor: 'rgba(247, 181, 0, 0.16)' }]}>
              <Feather name="clock" size={18} color={theme.colors.warning} />
            </View>
          </View>

          {order.description ? (
            <Text style={[styles.pendingDescription, { color: theme.colors.textSecondary }]}>
              {order.description}
            </Text>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => handleMarkAsPaid(order)}
              disabled={isMarking}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: theme.colors.success,
                  opacity: isMarking ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isMarking ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <>
                  <Feather name="check" size={16} color={theme.colors.surface} />
                  <Text style={[styles.primaryButtonText, { color: theme.colors.surface }]}>Mark as Paid</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleCancelOrder(order)}
              disabled={isCancelling}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: theme.colors.border,
                  opacity: isCancelling ? 0.6 : pressed ? 0.85 : 1,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <>
                  <Feather name="x" size={16} color={theme.colors.textPrimary} />
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.textPrimary }]}>Cancel</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      );
    },
    [cancellingOrderId, handleCancelOrder, handleMarkAsPaid, markingOrderId, theme.colors],
  );

  const renderPaidOrder = useCallback(
    ({ item: order }: { item: Order }) => {
      const paymentVisuals = getPaymentVisuals(order.paymentMethod, theme.colors);
      const isCancelling = cancellingOrderId === order.id;
      return (
        <View
          style={[
            styles.paidCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: 'rgba(45, 186, 127, 0.35)',
            },
          ]}
        >
          <View style={styles.paidHeader}>
            <View style={styles.paymentMeta}>
              <View
                style={[
                  styles.paymentIcon,
                  {
                    backgroundColor: paymentVisuals.background,
                  },
                ]}
              >
                <Feather name={paymentVisuals.icon} size={20} color={paymentVisuals.color} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={[styles.paymentMethod, { color: theme.colors.textPrimary }]}>
                  {formatPaymentLabel(order.paymentMethod)}
                </Text>
                <Text style={[styles.paymentMetaText, { color: theme.colors.textMuted }]}>
                  {formatTimeAgo(order.updatedAt)}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.amountValue, { color: theme.colors.success }]}>
                {formatCurrencyFromCents(order.totalCents, 'USD')}
              </Text>
              {order.taxCents > 0 ? (
                <Text style={[styles.taxText, { color: theme.colors.textMuted }]}>
                  incl. {formatCurrencyFromCents(order.taxCents, 'USD')} tax
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: 'rgba(45, 186, 127, 0.16)' }]}>
            <Text style={[styles.statusText, { color: theme.colors.success }]}>Payment Recorded</Text>
          </View>

          {order.buyerName ? (
            <View style={styles.detailRow}>
              <Feather name="user" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{order.buyerName}</Text>
            </View>
          ) : null}

          {order.description ? (
            <Text style={[styles.detailDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {order.description}
            </Text>
          ) : null}

          <Text style={[styles.detailTimestamp, { color: theme.colors.textMuted }]}>
            Order created {formatTimeAgo(order.createdAt)}
          </Text>

          <Pressable
            onPress={() => handleCancelOrder(order)}
            disabled={isCancelling}
            style={({ pressed }) => [
              styles.voidButton,
              {
                backgroundColor: theme.colors.error,
                opacity: isCancelling ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={theme.colors.surface} />
            ) : (
              <>
                <Feather name="x-circle" size={16} color={theme.colors.surface} />
                <Text style={[styles.voidButtonText, { color: theme.colors.surface }]}>Void Payment</Text>
              </>
            )}
          </Pressable>
        </View>
      );
    },
    [cancellingOrderId, handleCancelOrder, theme.colors],
  );

  const renderListHeader = useCallback(() => {
    return (
      <View style={styles.headerSection}>
        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            successColor={theme.colors.success}
            errorColor={theme.colors.error}
            infoColor={theme.colors.primary}
            surfaceColor={theme.colors.surface}
            textColor={theme.colors.textPrimary}
          />
        ) : null}

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: 'rgba(45, 186, 127, 0.28)',
            },
          ]}
        >
          <View style={{ gap: 6 }}>
            <Text style={[styles.summaryTitle, { color: theme.colors.success }]}>Payment History</Text>
            <Text style={[styles.summaryBody, { color: theme.colors.textSecondary }]}>
              {'Track every payment you\'ve confirmed across your apps.'}
            </Text>
          </View>
          <View style={styles.summaryFooter}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>Total collected</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
              {formatCurrencyFromCents(totalCollectedCents, 'USD')}
            </Text>
          </View>
        </View>

        {pendingOrders.length ? (
          <View style={styles.pendingSection}>
            <View
              style={[
                styles.pendingInfoCard,
                {
                  borderColor: theme.colors.warning,
                  backgroundColor: 'rgba(247, 181, 0, 0.14)',
                },
              ]}
            >
              <View style={{ gap: 4 }}>
                <Text style={[styles.pendingInfoTitle, { color: theme.colors.warning }]}>Pending follow-ups</Text>
                <Text style={[styles.pendingInfoBody, { color: theme.colors.textPrimary }]}>
                  Mark these orders as paid once you confirm money hit your account.
                </Text>
              </View>
            </View>

            {pendingOrders.map((order) => renderPendingOrder(order))}
          </View>
        ) : null}
      </View>
    );
  }, [feedback, pendingOrders, renderPendingOrder, theme.colors, totalCollectedCents]);

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }

    if (pendingOrders.length) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Feather name="archive" size={48} color={theme.colors.success} />
        <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No Payments Logged Yet</Text>
        <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
          {'Payments you record through cash or connected apps will appear here.'}
        </Text>
      </View>
    );
  }, [loading, pendingOrders.length, theme.colors]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={paidOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderPaidOrder}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  headerSection: {
    gap: 16,
    paddingTop: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  summaryBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  pendingSection: {
    gap: 12,
  },
  pendingInfoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  pendingInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pendingInfoBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  pendingMeta: {
    fontSize: 12,
  },
  pendingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  paidCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  paidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethod: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMetaText: {
    fontSize: 12,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  taxText: {
    fontSize: 11,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
  },
  detailDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  detailTimestamp: {
    fontSize: 11,
  },
  voidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  voidButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
