import { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@/providers/ThemeProvider';
import type { CartLine } from '@/state/cartStore';
import { formatCurrencyFromCents } from '@/utils/currency';

export type DiscountSelection = {
  id: string;
  type: 'percent' | 'amount';
  value: number;
  label: string;
};

export type CheckoutMethod = 'square' | 'venmo' | 'cashapp' | 'paypal' | 'cash';

export const DISCOUNT_PRESETS: DiscountSelection[] = [
  { id: 'percent10', type: 'percent', value: 10, label: '10% off' },
  { id: 'percent20', type: 'percent', value: 20, label: '20% off' },
  { id: 'amount5', type: 'amount', value: 500, label: '$5 off' },
  { id: 'amount10', type: 'amount', value: 1000, label: '$10 off' },
];

export const PAYMENT_BUTTONS: Array<{
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

interface CheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  themeColors: Theme['colors'];
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
  paymentSettings: {
    squareLink: string | null;
    venmoUsername: string | null;
    cashAppTag: string | null;
    paypalQrUri: string | null;
  };
}

export function CheckoutModal({
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
}: CheckoutModalProps) {
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
      </KeyboardAvoidingView>
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
  themeColors: Theme['colors'];
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
  themeColors: Theme['colors'];
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

const styles = StyleSheet.create({
  checkoutContainer: {
    flex: 1,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  checkoutTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  checkoutContent: {
    padding: 20,
    gap: 20,
  },
  checkoutLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  checkoutLineName: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkoutLinePrice: {
    fontSize: 13,
    marginTop: 2,
  },
  checkoutQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
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
    fontWeight: '500',
  },
  paymentButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '40%',
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCartContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
});