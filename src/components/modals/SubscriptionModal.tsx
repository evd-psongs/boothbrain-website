/**
 * Subscription Modal
 * Displays available subscription packages and handles purchase flow
 *
 * Features:
 * - Display monthly, quarterly, yearly subscription options
 * - Handle purchase with loading states
 * - Handle restore purchases
 * - Error handling and user feedback
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  initializeRevenueCat,
  isRevenueCatInitialized,
} from '@/lib/purchases';
import { syncSubscriptionToSupabase } from '@/lib/purchases';
import { PrimaryButton, SecondaryButton } from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  theme: Theme;
}

export function SubscriptionModal({
  visible,
  onClose,
  onSuccess,
  userId,
  theme,
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    if (visible && Platform.OS === 'ios') {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setLoading(true);
    setError(null);
    console.log('[SubscriptionModal] 🔍 Loading offerings...');
    console.log('[SubscriptionModal] User ID:', userId);
    console.log('[SubscriptionModal] Is initialized:', isRevenueCatInitialized());

    try {
      // Ensure RevenueCat is initialized before fetching offerings
      if (!isRevenueCatInitialized()) {
        console.log('[SubscriptionModal] ⚠️ RevenueCat not initialized, initializing now...');
        try {
          await initializeRevenueCat(userId);
          console.log('[SubscriptionModal] ✅ Initialization completed');
          console.log('[SubscriptionModal] Is now initialized:', isRevenueCatInitialized());
        } catch (initErr: any) {
          console.error('[SubscriptionModal] ❌ Failed to initialize RevenueCat:', initErr);
          setError('Failed to initialize payment system. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        console.log('[SubscriptionModal] ✅ RevenueCat already initialized');
      }

      console.log('[SubscriptionModal] 📦 Fetching offerings from RevenueCat...');
      const offering = await getOfferings();
      console.log('[SubscriptionModal] Offering received:', !!offering);

      if (offering && offering.availablePackages) {
        console.log('[SubscriptionModal] ✅ Available packages:', offering.availablePackages.length);
        setPackages(offering.availablePackages);
        // Auto-select quarterly by default (or first package)
        const quarterlyPkg = offering.availablePackages.find(
          (pkg) => pkg.identifier.includes('quarterly')
        );
        setSelectedPackage(quarterlyPkg || offering.availablePackages[0] || null);
        console.log('[SubscriptionModal] ✅ Selected package:', quarterlyPkg?.identifier || offering.availablePackages[0]?.identifier);
      } else {
        console.warn('[SubscriptionModal] ⚠️ No offering or packages available');
        setError('No subscription plans available');
      }
    } catch (err: any) {
      console.error('[SubscriptionModal] ❌ Error loading offerings:', err);
      console.error('[SubscriptionModal] ❌ Error message:', err.message);
      setError(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      setError('Please select a subscription plan');
      return;
    }

    setPurchasing(true);
    setError(null);
    try {
      const customerInfo = await purchasePackage(selectedPackage);

      // Sync to Supabase with retry logic
      // If sync fails, webhook will be the backup
      let syncSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await syncSubscriptionToSupabase(userId, customerInfo);
          syncSuccess = true;
          console.log('[SubscriptionModal] Sync succeeded on attempt', attempt);
          break;
        } catch (syncErr) {
          console.error(`[SubscriptionModal] Sync attempt ${attempt} failed:`, syncErr);
          if (attempt < 3) {
            // Wait before retry (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }

      if (!syncSuccess) {
        console.warn('[SubscriptionModal] All sync attempts failed, relying on webhook');
        // Don't fail the purchase - webhook will sync it
        // Show a different message to user
        setError('Purchase successful! Subscription will activate shortly.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.message === 'Purchase cancelled') {
        // User cancelled, don't show error
        return;
      }
      setError(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const customerInfo = await restorePurchases();

      // Sync to Supabase with retry logic
      let syncSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await syncSubscriptionToSupabase(userId, customerInfo);
          syncSuccess = true;
          console.log('[SubscriptionModal] Restore sync succeeded on attempt', attempt);
          break;
        } catch (syncErr) {
          console.error(`[SubscriptionModal] Restore sync attempt ${attempt} failed:`, syncErr);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }

      if (!syncSuccess) {
        console.warn('[SubscriptionModal] Restore sync failed, relying on webhook');
        setError('Purchases restored! Subscription will activate shortly.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const getPackageTitle = (pkg: PurchasesPackage): string => {
    if (pkg.identifier.includes('monthly')) return 'Monthly';
    if (pkg.identifier.includes('quarterly') || pkg.identifier.includes('three_month')) return 'Quarterly';
    if (pkg.identifier.includes('yearly') || pkg.identifier.includes('annual')) return 'Yearly';
    return pkg.identifier;
  };

  const getPackageDescription = (pkg: PurchasesPackage): string => {
    if (pkg.identifier.includes('monthly')) return 'Billed monthly';
    if (pkg.identifier.includes('quarterly') || pkg.identifier.includes('three_month')) return 'Billed every 3 months';
    if (pkg.identifier.includes('yearly') || pkg.identifier.includes('annual')) return 'Best value - Save 17%';
    return '';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Upgrade to Pro
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Features List */}
          <View style={[styles.featuresContainer, { borderColor: theme.colors.border }]}>
            <Text style={[styles.featuresTitle, { color: theme.colors.textPrimary }]}>
              Pro Features
            </Text>
            <View style={styles.feature}>
              <Feather name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Up to 500 inventory items
              </Text>
            </View>
            <View style={styles.feature}>
              <Feather name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Vendor collaboration tools
              </Text>
            </View>
            <View style={styles.feature}>
              <Feather name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Priority support
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading plans...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {error ? (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.error }]}>
                  <Feather name="alert-circle" size={20} color={theme.colors.error} />
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Package Selection */}
              <View style={styles.packagesContainer}>
                {packages.map((pkg) => {
                  const isSelected = selectedPackage?.identifier === pkg.identifier;
                  return (
                    <Pressable
                      key={pkg.identifier}
                      onPress={() => setSelectedPackage(pkg)}
                      disabled={purchasing || restoring}
                      style={({ pressed }) => [
                        styles.packageCard,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.surfaceMuted
                            : theme.colors.surface,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderWidth: isSelected ? 2 : 1,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={styles.packageHeader}>
                        <View style={styles.packageInfo}>
                          <Text style={[styles.packageTitle, { color: theme.colors.textPrimary }]}>
                            {getPackageTitle(pkg)}
                          </Text>
                          <Text style={[styles.packageDescription, { color: theme.colors.textSecondary }]}>
                            {getPackageDescription(pkg)}
                          </Text>
                        </View>
                        <View style={styles.packagePriceContainer}>
                          <Text style={[styles.packagePrice, { color: theme.colors.primary }]}>
                            {formatPrice(pkg)}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Feather name="check" size={16} color={theme.colors.primary} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Subscribe Button */}
              <View style={styles.buttonContainer}>
                <PrimaryButton
                  title={purchasing ? 'Processing...' : 'Subscribe Now'}
                  onPress={handlePurchase}
                  disabled={purchasing || restoring || !selectedPackage}
                  loading={purchasing}
                  backgroundColor={theme.colors.primary}
                  textColor={theme.colors.surface}
                />
              </View>

              {/* Restore Purchases Button */}
              <SecondaryButton
                title="Restore Purchases"
                onPress={handleRestore}
                disabled={purchasing || restoring}
                loading={restoring}
                backgroundColor={theme.colors.surface}
                borderColor={theme.colors.border}
                textColor={theme.colors.textPrimary}
              />

              {/* Terms */}
              <Text style={[styles.termsText, { color: theme.colors.textSecondary }]}>
                Subscriptions auto-renew unless cancelled. Cancel anytime in your Apple ID settings.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  featuresContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  packagesContainer: {
    marginBottom: 20,
  },
  packageCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
  },
  packagePriceContainer: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
