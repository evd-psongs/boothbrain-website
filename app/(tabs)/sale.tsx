import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { createOrder } from '@/lib/orders';
import { useInventory } from '@/hooks/useInventory';
import type { InventoryItem } from '@/types/inventory';
import { formatCurrencyFromCents } from '@/utils/currency';
import { fetchUserSettings, setUserSetting } from '@/lib/settings';
import { getItemImageUrl } from '@/lib/itemImages';
import { useCartStore, type CartLine } from '@/state/cartStore';
import type { PaymentMethod } from '@/types/orders';

type FeedbackState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

type DiscountSelection = {
  id: string;
  type: 'percent' | 'amount';
  value: number;
  label: string;
};

type PaymentCallout = {
  key: string;
  tone: 'primary' | 'warning';
  title: string;
  message: string;
  actionLabel: string;
  onPress: () => void;
};

const DISCOUNT_PRESETS: DiscountSelection[] = [
  { id: 'percent10', type: 'percent', value: 10, label: '10% off' },
  { id: 'percent20', type: 'percent', value: 20, label: '20% off' },
  { id: 'amount5', type: 'amount', value: 500, label: '$5 off' },
  { id: 'amount10', type: 'amount', value: 1000, label: '$10 off' },
];

const PAYMENT_SETTING_KEYS = ['squareLink', 'venmoUsername', 'cashAppTag', 'paypalQrUri'] as const;
const USER_SETTING_KEYS = [...PAYMENT_SETTING_KEYS, 'taxEnabled', 'taxRate'] as const;
const CALL_OUT_DISMISSALS_KEY = (userId: string) => `sale_callouts_${userId}`;

const DEFAULT_PAYMENT_SETTINGS: Record<(typeof PAYMENT_SETTING_KEYS)[number], string | null> = {
  squareLink: null,
  venmoUsername: null,
  cashAppTag: null,
  paypalQrUri: null,
};

type CheckoutMethod = 'square' | 'venmo' | 'cashapp' | 'paypal' | 'cash';

const PAYMENT_METHOD_MAP: Record<CheckoutMethod, PaymentMethod> = {
  cash: 'cash',
  cashapp: 'cash_app',
  paypal: 'paypal',
  square: 'square',
  venmo: 'venmo',
};

const PAYMENT_BUTTONS: Array<{
  method: CheckoutMethod;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  tint: string;
}> = [
  { method: 'square', label: 'Square', icon: 'credit-card', tint: '#1F2933' },
  { method: 'venmo', label: 'Venmo', icon: 'send', tint: '#3D95CE' },
  { method: 'cashapp', label: 'Cash App', icon: 'smartphone', tint: '#00C244' },
  { method: 'paypal', label: 'PayPal', icon: 'globe', tint: '#003087' },
  { method: 'cash', label: 'Cash', icon: 'dollar-sign', tint: '#2DBA7F' },
];

export default function SaleScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { currentSession, sharedOwnerId } = useSession();

  const userId = user?.id ?? null;
  const ownerUserId = sharedOwnerId ?? userId;
  const { items, loading, error, refresh } = useInventory(ownerUserId);

  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<CheckoutMethod | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [discountSelection, setDiscountSelection] = useState<DiscountSelection | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState('8.5');
  const [paymentSettings, setPaymentSettings] =
    useState<Record<(typeof PAYMENT_SETTING_KEYS)[number], string | null>>(DEFAULT_PAYMENT_SETTINGS);
  const [dismissedCallouts, setDismissedCallouts] = useState<string[]>([]);
  const [paypalModalVisible, setPayPalModalVisible] = useState(false);
  const settingsLoadedRef = useRef(false);
  const [imagePreview, setImagePreview] = useState<{ uri: string; title: string } | null>(null);

  const cartLines = useCartStore((state) => state.lines);
  const addItemToCart = useCartStore((state) => state.addItem);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const updateLine = useCartStore((state) => state.updateLine);
  const removeLine = useCartStore((state) => state.removeLine);
  const clearCart = useCartStore((state) => state.clear);
  const cartCount = useCartStore((state) => state.totalCount());
  const cartSubtotalCents = useCartStore((state) => state.totalCents());

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

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      void refresh();
      return undefined;
    }, [refresh, userId]),
  );

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      if (!userId) {
        setPaymentSettings(DEFAULT_PAYMENT_SETTINGS);
        setDismissedCallouts([]);
        settingsLoadedRef.current = false;
        return;
      }
      try {
        const [settingsResponse, storedDismissals] = await Promise.all([
          fetchUserSettings(
            userId,
            USER_SETTING_KEYS.map((key) => key),
          ),
          AsyncStorage.getItem(CALL_OUT_DISMISSALS_KEY(userId)),
        ]);
        if (!isMounted) return;
        const normalizedSettings: typeof paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
        PAYMENT_SETTING_KEYS.forEach((key) => {
          normalizedSettings[key] = settingsResponse[key] ?? null;
        });
        setPaymentSettings(normalizedSettings);
        const taxEnabledSetting = settingsResponse.taxEnabled;
        const taxRateSetting = settingsResponse.taxRate;
        if (typeof taxEnabledSetting === 'string') {
          setTaxEnabled(taxEnabledSetting === 'true' || taxEnabledSetting === '1');
        }
        if (typeof taxRateSetting === 'string' && taxRateSetting.trim().length > 0) {
          setTaxRateInput(taxRateSetting);
        }
        if (storedDismissals) {
          try {
            const parsed = JSON.parse(storedDismissals);
            if (Array.isArray(parsed)) {
              setDismissedCallouts(parsed);
            }
          } catch {
            setDismissedCallouts([]);
          }
        } else {
          setDismissedCallouts([]);
        }
        settingsLoadedRef.current = true;
      } catch (settingsError) {
        console.warn('Failed to load payment settings', settingsError);
        if (isMounted) {
          setPaymentSettings(DEFAULT_PAYMENT_SETTINGS);
          settingsLoadedRef.current = false;
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
      settingsLoadedRef.current = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.setItem(CALL_OUT_DISMISSALS_KEY(userId), JSON.stringify(dismissedCallouts)).catch(() => {});
  }, [dismissedCallouts, userId]);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem('boothbrain_device_id')
      .then((value) => {
        if (isMounted && value) {
          setDeviceId(value);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDeviceId(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);


  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }
    const normalized = searchQuery.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        (item.sku ? item.sku.toLowerCase().includes(normalized) : false),
    );
  }, [items, searchQuery]);

  const callouts: PaymentCallout[] = useMemo(() => {
    const tips: PaymentCallout[] = [];
    if (!paymentSettings.squareLink) {
      tips.push({
        key: 'square-link',
        tone: 'primary',
        title: 'Link your Square checkout',
        message: 'Add your Square payment URL so you can hand off card payments instantly.',
        actionLabel: 'Add Square link',
        onPress: () => router.push('/(tabs)/settings'),
      });
    }
    if (!paymentSettings.paypalQrUri) {
      tips.push({
        key: 'paypal-qr',
        tone: 'warning',
        title: 'Upload a PayPal QR code',
        message: 'Drop in your QR to speed through PayPal sales without typing emails.',
        actionLabel: 'Upload QR',
        onPress: () => router.push('/(tabs)/settings'),
      });
    }
    return tips.filter((tip) => !dismissedCallouts.includes(tip.key));
  }, [paymentSettings, dismissedCallouts, router]);

  const handleDismissCallout = useCallback((calloutKey: string) => {
    setDismissedCallouts((prev) => (prev.includes(calloutKey) ? prev : [...prev, calloutKey]));
  }, []);

  const handleAddToCart = useCallback(
    (item: InventoryItem) => {
      const added = addItemToCart(item);
      if (!added) {
        setFeedback({ type: 'error', message: 'Not enough stock to add that item.' });
        return;
      }
      setFeedback({ type: 'success', message: `${item.name} added to cart.` });
    },
    [addItemToCart],
  );

  const handleOpenQuantity = useCallback(
    (item: InventoryItem) => {
      setSelectedItem(item);
      const line = cartLines.find((entry) => entry.item.id === item.id);
      setQuantityInput(line ? String(line.quantity) : '1');
      setQuantityModalVisible(true);
    },
    [cartLines],
  );

  const handleRemoveFromCart = useCallback(
    (item: InventoryItem) => {
      const line = cartLines.find((entry) => entry.item.id === item.id);
      if (!line) return;
      removeLine(item.id);
      setFeedback({ type: 'success', message: `${item.name} removed from cart.` });
    },
    [cartLines, removeLine],
  );

  const handlePreviewImage = useCallback((item: InventoryItem, uri: string) => {
    setImagePreview({ uri, title: item.name });
  }, []);

  const handleApplyQuantity = useCallback(() => {
    if (!selectedItem) return;
    const quantity = Number.parseInt(quantityInput, 10);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setFeedback({ type: 'error', message: 'Enter a valid quantity.' });
      return;
    }
    const success = setItemQuantity(selectedItem, quantity);
    if (!success) {
      setFeedback({ type: 'error', message: 'Not enough stock for that quantity.' });
      return;
    }
    setFeedback({
      type: 'success',
      message: quantity === 0 ? `${selectedItem.name} removed from cart.` : 'Cart updated.',
    });
    setQuantityModalVisible(false);
    setSelectedItem(null);
  }, [quantityInput, selectedItem, setItemQuantity]);

  const handleSelectDiscountPreset = useCallback((preset: DiscountSelection) => {
    setDiscountSelection(preset);
    setFeedback({ type: 'info', message: `${preset.label} applied.` });
  }, []);

  const handleClearDiscount = useCallback(() => {
    setDiscountSelection(null);
    setFeedback({ type: 'info', message: 'Discount removed.' });
  }, []);

  const handleToggleTax = useCallback(
    (value: boolean) => {
      setTaxEnabled(value);
      if (settingsLoadedRef.current && userId) {
        setUserSetting(userId, 'taxEnabled', value ? 'true' : 'false').catch(() => {});
      }
    },
    [userId],
  );

  const handleTaxRateChange = useCallback(
    (value: string) => {
      setTaxRateInput(value);
      if (settingsLoadedRef.current && userId) {
        setUserSetting(userId, 'taxRate', value).catch(() => {});
      }
    },
    [userId],
  );

  const subtotalCents = cartSubtotalCents;

  const discountCents = useMemo(() => {
    if (!discountSelection) return 0;
    if (discountSelection.type === 'percent') {
      const percent = Math.min(Math.max(discountSelection.value, 0), 100);
      return Math.min(subtotalCents, Math.round(subtotalCents * (percent / 100)));
    }
    const amount = Math.max(0, Math.round(discountSelection.value));
    return Math.min(subtotalCents, amount);
  }, [discountSelection, subtotalCents]);

  const subtotalAfterDiscount = Math.max(subtotalCents - discountCents, 0);
  const parsedTaxRate = useMemo(() => {
    const parsed = Number.parseFloat(taxRateInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
  }, [taxRateInput]);

  const taxCents = useMemo(() => {
    if (!taxEnabled) return 0;
    return Math.round(subtotalAfterDiscount * (parsedTaxRate / 100));
  }, [taxEnabled, subtotalAfterDiscount, parsedTaxRate]);

  const grandTotalCents = subtotalAfterDiscount + taxCents;

  const buildOrderSummary = useCallback(() => {
    const summaryLines = cartLines.map((line) => `${line.quantity} × ${line.item.name}`);
    if (discountCents > 0) {
      summaryLines.push(`Discount: -${formatCurrencyFromCents(discountCents, 'USD')}`);
    }
    if (taxCents > 0) {
      summaryLines.push(`Tax: ${formatCurrencyFromCents(taxCents, 'USD')}`);
    }
    return summaryLines.join('\n');
  }, [cartLines, discountCents, taxCents]);

  const shareOrderSummary = useCallback(
    async (summary: string) => {
      if (!summary) return;
      try {
        await Share.share({
          title: 'BoothBrain Sale Summary',
          message: `Order total: ${formatCurrencyFromCents(grandTotalCents, 'USD')}\n\n${summary}`,
        });
      } catch {
        // ignore share errors
      }
    },
    [grandTotalCents],
  );

  const handleCheckout = useCallback(
    async (paymentMethod: CheckoutMethod) => {
      if (!cartLines.length) {
        setFeedback({ type: 'info', message: 'Add items to the cart before checking out.' });
        return;
      }
      if (!userId || !ownerUserId) {
        setFeedback({ type: 'error', message: 'Session owner not available yet.' });
        return;
      }
      if (isProcessingCheckout) return;

      setIsProcessingCheckout(true);
      setActivePaymentMethod(paymentMethod);

      const isCashPayment = paymentMethod === 'cash';
      const paymentUrlMap: Record<CheckoutMethod, string | null> = {
        square: paymentSettings.squareLink,
        venmo: paymentSettings.venmoUsername
          ? `https://venmo.com/${paymentSettings.venmoUsername.replace(/^@/, '')}`
          : null,
        cashapp: paymentSettings.cashAppTag
          ? `https://cash.app/${paymentSettings.cashAppTag.replace(/^\$/, '')}`
          : null,
        paypal: paymentSettings.paypalQrUri ? 'paypal-qr' : 'paypal-manual',
        cash: 'cash-offline',
      };

      const target = paymentUrlMap[paymentMethod];

      try {
        if (!isCashPayment) {
          if (!target) {
            setFeedback({
              type: 'error',
              message: 'Add your payment details in Settings to use this method.',
            });
            return;
          }

          if (target === 'paypal-qr') {
            setPayPalModalVisible(true);
          } else if (target === 'paypal-manual') {
            setFeedback({
              type: 'info',
              message: 'Collect PayPal payment manually and mark the order paid when finished.',
            });
          } else {
            try {
              const supported = await Linking.canOpenURL(target);
              if (!supported) {
                setFeedback({
                  type: 'error',
                  message: 'Payment app is not installed or the link is invalid.',
                });
                return;
              }
              await Linking.openURL(target);
            } catch (err) {
              console.warn('Failed to open payment link', err);
              setFeedback({
                type: 'error',
                message: 'Could not open the payment app.',
              });
              return;
            }
          }
        }

        const summary = buildOrderSummary();
        const orderLines = cartLines
          .filter((line) => line.quantity > 0)
          .map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
            priceCents: line.item.priceCents,
          }));

        if (!orderLines.length) {
          setFeedback({ type: 'error', message: 'Unable to record an empty order.' });
          return;
        }

        const taxRateBps = parsedTaxRate > 0 ? Math.round(parsedTaxRate * 100) : null;

        try {
          await createOrder({
            userId: ownerUserId,
            sessionId: currentSession?.eventId ?? null,
            sessionUuid: currentSession?.sessionId ?? null,
            paymentMethod: PAYMENT_METHOD_MAP[paymentMethod],
            totalCents: grandTotalCents,
            taxCents,
            taxRateBps,
            description: summary || null,
            deviceId: deviceId ?? null,
            status: 'paid',
            lines: orderLines,
          });
        } catch (err: any) {
          console.warn('Failed to record order', err);
          setFeedback({
            type: 'error',
            message: err?.message ?? 'Failed to record order. Try again.',
          });
          return;
        }

        if (!isCashPayment) {
          await shareOrderSummary(summary);
        }

        clearCart();
        setDiscountSelection(null);
        setCheckoutVisible(false);
        void refresh();
        setFeedback({
          type: 'success',
          message: isCashPayment
            ? 'Cash sale recorded. Order saved to history.'
            : 'Sale recorded. Order saved to history.',
        });
      } finally {
        setIsProcessingCheckout(false);
        setActivePaymentMethod(null);
      }
    },
    [
      cartLines,
      currentSession?.eventId,
      currentSession?.sessionId,
      deviceId,
      paymentSettings.cashAppTag,
      paymentSettings.paypalQrUri,
      paymentSettings.squareLink,
      paymentSettings.venmoUsername,
      clearCart,
      grandTotalCents,
      parsedTaxRate,
      setDiscountSelection,
      shareOrderSummary,
      buildOrderSummary,
      setCheckoutVisible,
      setFeedback,
      taxCents,
      refresh,
      userId,
      ownerUserId,
      isProcessingCheckout,
    ],
  );

  const cartSummaryLabel = useMemo(() => {
    if (!cartLines.length) return 'Cart is empty';
    return `${cartLines.length} item${cartLines.length === 1 ? '' : 's'} in cart`;
  }, [cartLines.length]);

  const firstPaypalImage = useMemo(() => {
    if (!paymentSettings.paypalQrUri) return null;
    if (paymentSettings.paypalQrUri.startsWith('data:')) {
      return paymentSettings.paypalQrUri;
    }
    return `data:image/png;base64,${paymentSettings.paypalQrUri}`;
  }, [paymentSettings.paypalQrUri]);

  useEffect(() => {
    if (cartCount === 0 && discountSelection) {
      setDiscountSelection(null);
    }
  }, [cartCount, discountSelection, setDiscountSelection]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            successColor={theme.colors.success}
            errorColor={theme.colors.error}
            infoColor={theme.colors.primary}
          />
        ) : null}

        {callouts.length ? (
          <View style={styles.calloutList}>
            {callouts.map((callout) => (
              <PaymentCalloutCard
                key={callout.key}
                callout={callout}
                themeColors={theme.colors}
                onDismiss={() => handleDismissCallout(callout.key)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Feather
                name="shopping-bag"
                size={18}
                color={theme.colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.pageTitle, { color: theme.colors.textPrimary }]}>Sale</Text>
            </View>
            <StatusPill
              label={currentSession ? 'Live session' : 'Single device'}
              tone={currentSession ? 'info' : 'default'}
              themeColors={theme.colors}
            />
          </View>
          <View style={styles.headerSubtitleRow}>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Ring up orders and take payment.</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: theme.colors.primary }]} />
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or SKU"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={12}>
              <Feather name="x" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InventoryListItem
              item={item}
              themeColors={theme.colors}
              inCartQuantity={cartLines.find((line) => line.item.id === item.id)?.quantity ?? 0}
              onAdd={() => handleAddToCart(item)}
              onAdjust={() => handleOpenQuantity(item)}
              onRemove={() => handleRemoveFromCart(item)}
              onPreviewImage={(uri) => handlePreviewImage(item, uri)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Feather name="shopping-bag" size={24} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                  No items found
                </Text>
                <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
                  Add your first product or adjust your filters.
                </Text>
              </View>
            )
          }
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
          ListFooterComponent={<View style={{ height: 120 }} />}
        />

        {cartLines.length ? (
          <CartSummaryBar
            themeColors={theme.colors}
            label={cartSummaryLabel}
            subtotal={grandTotalCents}
            disabled={false}
            onPress={() => setCheckoutVisible(true)}
          />
        ) : null}

        <CheckoutModal
          visible={checkoutVisible}
          onClose={() => setCheckoutVisible(false)}
          themeColors={theme.colors}
          lines={cartLines}
          subtotalCents={subtotalCents}
          discountSelection={discountSelection}
          taxEnabled={taxEnabled}
          taxRateInput={taxRateInput}
          discountCents={discountCents}
          taxCents={taxCents}
          totalCents={grandTotalCents}
          onSelectDiscount={handleSelectDiscountPreset}
          onClearDiscount={handleClearDiscount}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onToggleTax={handleToggleTax}
          onTaxRateChange={handleTaxRateChange}
          onCheckout={handleCheckout}
          isProcessing={isProcessingCheckout}
          processingMethod={activePaymentMethod}
          paymentSettings={paymentSettings}
        />

        <QuantityModal
          visible={quantityModalVisible}
          onClose={() => {
            setQuantityModalVisible(false);
            setSelectedItem(null);
          }}
          onConfirm={handleApplyQuantity}
          quantityInput={quantityInput}
          onChangeQuantity={setQuantityInput}
          themeColors={theme.colors}
          item={selectedItem}
        />

        <Modal visible={paypalModalVisible} animationType="slide" onRequestClose={() => setPayPalModalVisible(false)} transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.paypalModalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Scan PayPal QR</Text>
                <Pressable onPress={() => setPayPalModalVisible(false)} hitSlop={12}>
                  <Feather name="x" size={18} color={theme.colors.textMuted} />
                </Pressable>
              </View>
              {firstPaypalImage ? (
                <Image source={{ uri: firstPaypalImage }} style={styles.paypalImage} resizeMode="contain" />
              ) : (
                <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                  Upload your PayPal QR code in Settings to display it here.
                </Text>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(imagePreview)} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                  {imagePreview?.title ?? 'Item image'}
                </Text>
                <Pressable onPress={() => setImagePreview(null)} hitSlop={12}>
                  <Feather name="x" size={18} color={theme.colors.textMuted} />
                </Pressable>
              </View>
              {imagePreview ? (
                <Image source={{ uri: imagePreview.uri }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>
          </View>
        </Modal>

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function FeedbackBanner({
  feedback,
  successColor,
  errorColor,
  infoColor,
}: {
  feedback: FeedbackState;
  successColor: string;
  errorColor: string;
  infoColor: string;
}) {
  if (!feedback) return null;
  const palette =
    feedback.type === 'success'
      ? { border: successColor, background: 'rgba(45, 186, 127, 0.12)', text: successColor }
      : feedback.type === 'error'
      ? { border: errorColor, background: 'rgba(243, 105, 110, 0.12)', text: errorColor }
      : { border: infoColor, background: 'rgba(101, 88, 245, 0.12)', text: infoColor };
  return (
    <View style={[styles.feedbackBanner, { borderColor: palette.border, backgroundColor: palette.background }]}>
      <Text style={[styles.feedbackText, { color: palette.text }]}>{feedback.message}</Text>
    </View>
  );
}

function PaymentCalloutCard({
  callout,
  themeColors,
  onDismiss,
}: {
  callout: PaymentCallout;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  onDismiss: () => void;
}) {
  const background = callout.tone === 'warning' ? 'rgba(247, 181, 0, 0.12)' : 'rgba(101, 88, 245, 0.12)';
  const accent = callout.tone === 'warning' ? themeColors.warning : themeColors.primary;
  return (
    <View style={[styles.calloutCard, { borderColor: accent, backgroundColor: background }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.calloutTitle, { color: themeColors.textPrimary }]}>{callout.title}</Text>
        <Text style={[styles.calloutBody, { color: themeColors.textSecondary }]}>{callout.message}</Text>
        <Pressable onPress={callout.onPress} style={({ pressed }) => [styles.calloutAction, { opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.calloutActionText, { color: accent }]}>{callout.actionLabel}</Text>
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} hitSlop={12}>
        <Feather name="x" size={16} color={themeColors.textMuted} />
      </Pressable>
    </View>
  );
}

function InventoryListItem({
  item,
  themeColors,
  inCartQuantity,
  onAdd,
  onAdjust,
  onRemove,
  onPreviewImage,
}: {
  item: InventoryItem;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  inCartQuantity: number;
  onAdd: () => void;
  onAdjust: () => void;
  onRemove: () => void;
  onPreviewImage?: (uri: string) => void;
}) {
  const firstImagePath = item.imagePaths?.[0] ?? null;
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!firstImagePath) {
      setImageUri(null);
      return () => {
        isActive = false;
      };
    }

    (async () => {
      try {
        const url = await getItemImageUrl(firstImagePath);
        if (isActive) {
          setImageUri(url);
        }
      } catch (error) {
        console.warn('Failed to load inventory image', error);
        if (isActive) {
          setImageUri(null);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [firstImagePath]);
  const lowStock = item.quantity > 0 && item.quantity <= Math.max(item.lowStockThreshold, 0);
  const outOfStock = item.quantity <= 0;

  return (
    <View style={[styles.itemCard, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemSku, { color: themeColors.textSecondary }]}>
            {item.sku ? `SKU ${item.sku}` : 'No SKU'}
          </Text>
        </View>
        <Text style={[styles.itemPrice, { color: themeColors.textPrimary }]}>
          {formatCurrencyFromCents(item.priceCents, 'USD')}
        </Text>
      </View>

      {imageUri ? (
        <Pressable
          onPress={() => onPreviewImage?.(imageUri)}
          style={{ borderRadius: 12, overflow: 'hidden' }}
          accessibilityRole="imagebutton"
          accessibilityLabel={`View ${item.name} image`}
        >
          <Image source={{ uri: imageUri }} style={styles.itemImage} resizeMode="cover" />
        </Pressable>
      ) : null}

      <View style={styles.itemFooter}>
        <View style={styles.itemStatusRow}>
          <StatusPill
            label={outOfStock ? 'Out of stock' : `${item.quantity} in stock`}
            tone={outOfStock ? 'error' : lowStock ? 'warning' : 'default'}
            themeColors={themeColors}
          />
          {inCartQuantity > 0 ? (
            <StatusPill
              label={`${inCartQuantity} in cart`}
              tone="info"
              themeColors={themeColors}
            />
          ) : null}
        </View>
        <View style={styles.itemActionRow}>
          <Pressable
            onPress={onAdjust}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: themeColors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: themeColors.textPrimary }]}>Adjust</Text>
          </Pressable>
          {inCartQuantity > 0 ? (
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: themeColors.error, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.error }]}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: themeColors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: themeColors.surface }]}>Add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StatusPill({
  label,
  tone,
  themeColors,
}: {
  label: string;
  tone: 'default' | 'warning' | 'error' | 'info';
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  const palette =
    tone === 'warning'
      ? { background: 'rgba(247, 181, 0, 0.12)', color: themeColors.warning }
      : tone === 'error'
      ? { background: 'rgba(243, 105, 110, 0.12)', color: themeColors.error }
      : tone === 'info'
      ? { background: 'rgba(101, 88, 245, 0.12)', color: themeColors.primary }
      : { background: 'rgba(32, 34, 46, 0.08)', color: themeColors.textSecondary };

  return (
    <View style={[styles.statusPill, { backgroundColor: palette.background }]}>
      <Text style={[styles.statusPillText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

function CartSummaryBar({
  themeColors,
  label,
  subtotal,
  disabled,
  onPress,
}: {
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  label: string;
  subtotal: number;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.cartBar,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}
    >
      <View>
        <Text style={[styles.cartBarLabel, { color: themeColors.textPrimary }]}>{label}</Text>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Tap to review & checkout</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.cartBarTotal, { color: themeColors.textPrimary }]}>
          {formatCurrencyFromCents(subtotal, 'USD')}
        </Text>
        <Feather name="chevron-up" size={18} color={themeColors.textPrimary} />
      </View>
    </Pressable>
  );
}

function CheckoutModal({
  visible,
  onClose,
  themeColors,
  lines,
  subtotalCents,
  discountSelection,
  taxEnabled,
  taxRateInput,
  discountCents,
  taxCents,
  totalCents,
  onSelectDiscount,
  onClearDiscount,
  onUpdateLine,
  onRemoveLine,
  onToggleTax,
  onTaxRateChange,
  onCheckout,
  isProcessing,
  processingMethod,
  paymentSettings,
}: {
  visible: boolean;
  onClose: () => void;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  lines: CartLine[];
  subtotalCents: number;
  discountSelection: DiscountSelection | null;
  taxEnabled: boolean;
  taxRateInput: string;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  onSelectDiscount: (preset: DiscountSelection) => void;
  onClearDiscount: () => void;
  onUpdateLine: (itemId: string, quantity: number) => void;
  onRemoveLine: (itemId: string) => void;
  onToggleTax: (value: boolean) => void;
  onTaxRateChange: (value: string) => void;
  onCheckout: (method: CheckoutMethod) => void;
  isProcessing: boolean;
  processingMethod: CheckoutMethod | null;
  paymentSettings: Record<(typeof PAYMENT_SETTING_KEYS)[number], string | null>;
}) {
  const paymentOptions = useMemo(
    () =>
      PAYMENT_BUTTONS.map((button) => {
        let disabled = false;
        if (button.method === 'square') {
          disabled = !paymentSettings.squareLink;
        } else if (button.method === 'venmo') {
          disabled = !paymentSettings.venmoUsername;
        } else if (button.method === 'cashapp') {
          disabled = !paymentSettings.cashAppTag;
        } else if (button.method === 'paypal') {
          disabled = !paymentSettings.paypalQrUri;
        }
        return {
          ...button,
          disabled,
        };
      }),
    [
      paymentSettings.cashAppTag,
      paymentSettings.paypalQrUri,
      paymentSettings.squareLink,
      paymentSettings.venmoUsername,
    ],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.checkoutContainer, { backgroundColor: themeColors.background }]}>
        <View style={styles.checkoutHeader}>
          <Text style={[styles.checkoutTitle, { color: themeColors.textPrimary }]}>Cart</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.checkoutContent}>
          {lines.map((line) => (
            <View
              key={line.item.id}
              style={[styles.checkoutLine, { borderColor: themeColors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkoutLineName, { color: themeColors.textPrimary }]}>
                  {line.item.name}
                </Text>
                <Text style={[styles.checkoutLinePrice, { color: themeColors.textSecondary }]}>
                  {formatCurrencyFromCents(line.item.priceCents, 'USD')}
                </Text>
              </View>
              <View style={styles.checkoutQuantityControls}>
                <Pressable
                  onPress={() => onUpdateLine(line.item.id, Math.max(0, line.quantity - 1))}
                  style={({ pressed }) => [
                    styles.quantityButton,
                    { backgroundColor: 'rgba(9, 10, 15, 0.08)', opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="minus" size={14} color={themeColors.textPrimary} />
                </Pressable>
                <Text style={[styles.quantityValue, { color: themeColors.textPrimary }]}>
                  {line.quantity}
                </Text>
                <Pressable
                  onPress={() => onUpdateLine(line.item.id, line.quantity + 1)}
                  style={({ pressed }) => [
                    styles.quantityButton,
                    { backgroundColor: themeColors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="plus" size={14} color={themeColors.surface} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => onRemoveLine(line.item.id)}
                hitSlop={14}
                style={{ marginLeft: 8 }}
              >
                <Feather name="trash-2" size={16} color={themeColors.error} />
              </Pressable>
            </View>
          ))}

          {lines.length ? (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Discounts</Text>
                <View style={styles.presetRow}>
                  {DISCOUNT_PRESETS.map((preset) => {
                    const isActive = discountSelection?.id === preset.id;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => onSelectDiscount(preset)}
                        style={({ pressed }) => [
                          styles.presetChip,
                          {
                            backgroundColor: isActive ? themeColors.primary : 'transparent',
                            borderColor: themeColors.primary,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: isActive ? themeColors.surface : themeColors.primary },
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={onClearDiscount} style={styles.linkButton}>
                  <Text style={[styles.linkButtonText, { color: themeColors.textSecondary }]}>
                    Clear discount
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.section, styles.taxRow]}>
                <View>
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Sales tax</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Apply tax automatically during checkout.
                  </Text>
                </View>
                <Switch value={taxEnabled} onValueChange={onToggleTax} />
              </View>

              {taxEnabled ? (
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Rate (%)</Text>
                  <TextInput
                    value={taxRateInput}
                    onChangeText={onTaxRateChange}
                    keyboardType="decimal-pad"
                    placeholder="8.5"
                    placeholderTextColor={themeColors.textMuted}
                    style={[
                      styles.textInput,
                      { borderColor: themeColors.border, color: themeColors.textPrimary },
                    ]}
                  />
                </View>
              ) : null}

              <View style={[styles.section, { gap: 8 }]}>
                <SummaryRow
                  label="Subtotal"
                  value={formatCurrencyFromCents(subtotalCents, 'USD')}
                  themeColors={themeColors}
                />
                <SummaryRow
                  label="Discounts"
                  value={`-${formatCurrencyFromCents(discountCents, 'USD')}`}
                  themeColors={themeColors}
                />
                <SummaryRow
                  label="Tax"
                  value={formatCurrencyFromCents(taxCents, 'USD')}
                  themeColors={themeColors}
                />
                <SummaryRow
                  label="Total"
                  value={formatCurrencyFromCents(totalCents, 'USD')}
                  themeColors={themeColors}
                  emphasize
                />
              </View>

              <View style={[styles.section, { gap: 12 }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                  Take payment
                </Text>
                <View style={styles.paymentButtonGrid}>
                  {paymentOptions.map((option) => (
                    <PaymentButton
                      key={option.method}
                      label={option.label}
                      icon={option.icon}
                      onPress={() => onCheckout(option.method)}
                      themeColors={themeColors}
                      disabled={option.disabled || isProcessing}
                      tintColor={option.tint}
                      loading={isProcessing && processingMethod === option.method}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyCartContainer}>
              <Feather name="shopping-cart" size={24} color={themeColors.textMuted} />
              <Text style={{ color: themeColors.textSecondary, marginTop: 8 }}>
                Add items to your cart to begin checkout.
              </Text>
            </View>
          )}
        </ScrollView>

      </SafeAreaView>
    </Modal>
  );
}

function SummaryRow({
  label,
  value,
  themeColors,
  emphasize,
}: {
  label: string;
  value: string;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          { color: emphasize ? themeColors.textPrimary : themeColors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          { color: emphasize ? themeColors.textPrimary : themeColors.textSecondary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function PaymentButton({
  label,
  icon,
  onPress,
  disabled,
  themeColors,
  tintColor,
  loading,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  tintColor?: string;
  loading?: boolean;
}) {
  const hasTint = Boolean(tintColor);
  const backgroundColor = hasTint ? tintColor! : themeColors.surface;
  const textColor = hasTint ? themeColors.surface : themeColors.textPrimary;
  const borderColor = hasTint ? 'transparent' : themeColors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.paymentButton,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.35 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Feather name={icon} size={16} color={textColor} />
      )}
      <Text style={[styles.paymentButtonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function QuantityModal({
  visible,
  onClose,
  onConfirm,
  quantityInput,
  onChangeQuantity,
  themeColors,
  item,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quantityInput: string;
  onChangeQuantity: (value: string) => void;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  item: InventoryItem | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.quantityCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
            {item ? `Adjust ${item.name}` : 'Adjust quantity'}
          </Text>
          <TextInput
            value={quantityInput}
            onChangeText={onChangeQuantity}
            keyboardType="number-pad"
            placeholder="Quantity"
            placeholderTextColor={themeColors.textMuted}
            style={[
              styles.textInput,
              { borderColor: themeColors.border, color: themeColors.textPrimary },
            ]}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: themeColors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.textPrimary }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: themeColors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: themeColors.surface }]}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  feedbackBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calloutList: {
    gap: 12,
    marginBottom: 20,
  },
  calloutCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  calloutAction: {
    marginTop: 10,
  },
  calloutActionText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  headerContainer: {
    marginBottom: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  headerAccent: {
    height: 4,
    borderRadius: 999,
    width: 56,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 32,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSku: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(9, 10, 15, 0.05)',
  },
  itemFooter: {
    flexDirection: 'column',
    gap: 12,
  },
  itemStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    alignSelf: 'stretch',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    elevation: 8,
    shadowColor: 'rgba(10, 13, 25, 0.18)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  cartBarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cartBarTotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  checkoutContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checkoutTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  checkoutContent: {
    paddingBottom: 160,
    gap: 16,
  },
  checkoutLine: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkoutLineName: {
    fontSize: 15,
    fontWeight: '600',
  },
  checkoutLinePrice: {
    fontSize: 12,
  },
  checkoutQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    borderColor: 'rgba(32, 34, 46, 0.08)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 8,
  },
  linkButtonText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(32, 34, 46, 0.08)',
  },
  inputLabel: {
    fontSize: 13,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 100,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentButtonGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  paymentButton: {
    flexGrow: 1,
    flexBasis: '48%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCartContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  paypalModalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  paypalImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: 'rgba(9, 10, 15, 0.08)',
  },
  previewCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    maxHeight: '90%',
  },
  previewImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: 'rgba(9, 10, 15, 0.08)',
  },
  quantityCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,10,15,0.08)',
  },
});
