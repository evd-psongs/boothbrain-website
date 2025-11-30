import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardTypeOptions,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  PrimaryButton,
  SecondaryButton,
  InputField,
  SectionHeading,
} from '@/components/common';
import { deleteUserSetting, fetchUserSettings, setUserSetting } from '@/lib/settings';
import type { Theme } from '@/providers/ThemeProvider';

type PaymentField = 'venmoUsername' | 'cashAppTag' | 'paypalQrUri';

type PaymentValues = Record<PaymentField, string>;

type PaymentFieldConfig = {
  field: PaymentField;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
};

const PAYMENT_FIELDS: PaymentField[] = ['venmoUsername', 'cashAppTag', 'paypalQrUri'];

const PAYMENT_CONFIG: PaymentFieldConfig[] = [
  {
    field: 'venmoUsername',
    label: 'Venmo username',
    placeholder: '@yourname',
  },
  {
    field: 'cashAppTag',
    label: 'Cash App tag',
    placeholder: '$yourtag',
  },
];

const DEFAULT_PAYMENT_VALUES: PaymentValues = {
  venmoUsername: '',
  cashAppTag: '',
  paypalQrUri: '',
};

interface PaymentSettingsSectionProps {
  theme: Theme;
  userId: string | undefined;
  showFeedback: (state: { type: 'success' | 'error'; message: string }) => void;
}

export function PaymentSettingsSection({ theme, userId, showFeedback }: PaymentSettingsSectionProps) {
  const [paymentValues, setPaymentValues] = useState<PaymentValues>(DEFAULT_PAYMENT_VALUES);
  const [initialPaymentValues, setInitialPaymentValues] = useState<PaymentValues>(DEFAULT_PAYMENT_VALUES);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [uploadingPaypalQr, setUploadingPaypalQr] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPaymentValues(DEFAULT_PAYMENT_VALUES);
      setInitialPaymentValues(DEFAULT_PAYMENT_VALUES);
      setLoadingPayments(false);
      return;
    }

    let isCancelled = false;
    setLoadingPayments(true);

    const loadSettings = async () => {
      try {
        const result = await fetchUserSettings(userId, PAYMENT_FIELDS);
        if (isCancelled) return;
        const normalized = PAYMENT_FIELDS.reduce<PaymentValues>((acc, key) => {
          acc[key] = (result[key] ?? '').trim();
          return acc;
        }, { ...DEFAULT_PAYMENT_VALUES });
        setPaymentValues(normalized);
        setInitialPaymentValues(normalized);
      } catch (error: any) {
        if (isCancelled) return;
        console.error('Failed to load payment settings', error);
        showFeedback({ type: 'error', message: error?.message ?? 'Failed to load payment settings.' });
      } finally {
        if (!isCancelled) setLoadingPayments(false);
      }
    };

    void loadSettings();

    return () => {
      isCancelled = true;
    };
  }, [userId, showFeedback]);

  const paymentsDirty = useMemo(
    () => PAYMENT_FIELDS.some((field) => paymentValues[field] !== initialPaymentValues[field]),
    [paymentValues, initialPaymentValues],
  );

  const handleSavePaymentSettings = useCallback(async () => {
    if (!userId || !paymentsDirty) return;
    setSavingPayments(true);
    try {
      const trimmedValues = PAYMENT_FIELDS.reduce<PaymentValues>((acc, field) => {
        const rawValue = paymentValues[field];
        acc[field] = field === 'paypalQrUri' ? rawValue : rawValue.trim();
        return acc;
      }, { ...DEFAULT_PAYMENT_VALUES });

      const operations = PAYMENT_FIELDS.reduce<Promise<void>[]>((acc, field) => {
        const value = trimmedValues[field];
        const initialValue = initialPaymentValues[field].trim();
        if (value === initialValue) return acc;
        if (!value) {
          acc.push(deleteUserSetting(userId, field));
        } else {
          acc.push(setUserSetting(userId, field, value));
        }
        return acc;
      }, []);

      if (operations.length) {
        await Promise.all(operations);
      }

      setPaymentValues(trimmedValues);
      setInitialPaymentValues(trimmedValues);
      showFeedback({ type: 'success', message: 'Payment preferences saved.' });
    } catch (error: any) {
      console.error('Failed to save payment settings', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to save payment settings.' });
    } finally {
      setSavingPayments(false);
    }
  }, [userId, paymentsDirty, paymentValues, initialPaymentValues, showFeedback]);

  const handleSetPaymentField = useCallback((field: PaymentField, value: string) => {
    setPaymentValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleUploadPaypalQr = useCallback(async () => {
    try {
      setUploadingPaypalQr(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showFeedback({ type: 'error', message: 'Enable photo access to upload a QR code.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        showFeedback({ type: 'error', message: 'Unable to process the selected image.' });
        return;
      }

      const mimeType =
        (asset as { mimeType?: string }).mimeType
        ?? (asset.uri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      setPaymentValues((prev) => ({ ...prev, paypalQrUri: dataUrl }));
    } catch (error: any) {
      console.error('Failed to upload PayPal QR', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to upload QR code.' });
    } finally {
      setUploadingPaypalQr(false);
    }
  }, [showFeedback]);

  const handleRemovePaypalQr = useCallback(() => {
    setPaymentValues((prev) => ({ ...prev, paypalQrUri: '' }));
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <SectionHeading
        title="Payment preferences"
        subtitle="Store quick links for customers when using your POS."
        titleColor={theme.colors.textPrimary}
        subtitleColor={theme.colors.textSecondary}
      />

      {loadingPayments ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading payment links…</Text>
        </View>
      ) : (
        <>
          {PAYMENT_CONFIG.map((config) => (
            <InputField
              key={config.field}
              label={config.label}
              value={paymentValues[config.field]}
              onChange={(value) => handleSetPaymentField(config.field, value)}
              placeholder={config.placeholder}
              placeholderColor={theme.colors.textMuted}
              borderColor={theme.colors.border}
              backgroundColor={theme.colors.surface}
              textColor={theme.colors.textPrimary}
              keyboardType={config.keyboardType}
              autoCapitalize="none"
            />
          ))}

          <View style={styles.paypalSection}>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>PayPal QR code</Text>
            <Text style={[styles.paypalHelpText, { color: theme.colors.textMuted }]}>
              Upload a QR code image so shoppers can scan and pay with PayPal.
            </Text>
            <View
              style={[
                styles.paypalPreview,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              {paymentValues.paypalQrUri ? (
                <Image source={{ uri: paymentValues.paypalQrUri }} style={styles.paypalImage} resizeMode="contain" />
              ) : (
                <Text style={[styles.paypalPlaceholder, { color: theme.colors.textMuted }]}>
                  No QR code uploaded yet.
                </Text>
              )}
            </View>

            <View style={styles.paypalActions}>
              <Pressable
                onPress={handleUploadPaypalQr}
                disabled={uploadingPaypalQr}
                style={({ pressed }) => [
                  styles.paypalUploadButton,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: pressed ? theme.colors.primary : 'transparent',
                  },
                  uploadingPaypalQr ? { opacity: 0.6 } : null,
                ]}
              >
                {uploadingPaypalQr ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <>
                    <Text style={[styles.paypalUploadText, { color: theme.colors.primary }]}>
                      {paymentValues.paypalQrUri ? 'Replace QR code' : 'Upload QR code'}
                    </Text>
                    <Text style={[styles.paypalUploadHint, { color: theme.colors.textMuted }]}>
                      PNG or JPG, crop before saving.
                    </Text>
                  </>
                )}
              </Pressable>
              {paymentValues.paypalQrUri ? (
                <SecondaryButton
                  style={styles.paypalRemoveButton}
                  title="Remove QR code"
                  onPress={handleRemovePaypalQr}
                  disabled={uploadingPaypalQr}
                  loading={false}
                  backgroundColor={theme.colors.surface}
                  borderColor={theme.colors.border}
                  textColor={theme.colors.textPrimary}
                />
              ) : null}
            </View>
          </View>

          <PrimaryButton
            title="Save payment links"
            onPress={handleSavePaymentSettings}
            disabled={!paymentsDirty || savingPayments}
            loading={savingPayments}
            backgroundColor={theme.colors.primaryDark}
            textColor={theme.colors.surface}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  paypalSection: {
    marginTop: 8,
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  paypalHelpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  paypalPreview: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  paypalPlaceholder: {
    fontSize: 13,
  },
  paypalImage: {
    width: '100%',
    height: 180,
  },
  paypalActions: {
    width: '100%',
  },
  paypalUploadButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  paypalUploadText: {
    fontSize: 15,
    fontWeight: '600',
  },
  paypalUploadHint: {
    fontSize: 12,
    marginTop: 4,
  },
  paypalRemoveButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
});