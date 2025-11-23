import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton, SectionHeading, KeyboardDismissibleView, type FeedbackState } from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';
import {
  isTwoFactorEnabled,
  enrollTwoFactor,
  verifyTwoFactorEnrollment,
  unenrollTwoFactor,
  getTwoFactorFactors,
  type TwoFactorEnrollment,
  type TwoFactorFactor,
} from '@/utils/twoFactor';

type TwoFactorSectionProps = {
  theme: Theme;
  showFeedback: (state: FeedbackState) => void;
};

export function TwoFactorSection({ theme, showFeedback }: TwoFactorSectionProps) {
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [factors, setFactors] = useState<TwoFactorFactor[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const loadTwoFactorStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [enabled, factorsResult] = await Promise.all([
        isTwoFactorEnabled(),
        getTwoFactorFactors(),
      ]);

      setTwoFactorEnabled(enabled);
      if (factorsResult.success && factorsResult.factors) {
        setFactors(factorsResult.factors);
      }
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTwoFactorStatus();
  }, [loadTwoFactorStatus]);

  const handleEnableClick = useCallback(async () => {
    setEnrolling(true);
    try {
      const result = await enrollTwoFactor('Authenticator App');

      if (!result.success || !result.enrollment) {
        showFeedback({
          type: 'error',
          message: result.error || 'Failed to start 2FA enrollment',
        });
        return;
      }

      setEnrollment(result.enrollment);
      setShowEnrollModal(true);
    } catch (error) {
      console.error('Failed to enroll in 2FA:', error);
      showFeedback({
        type: 'error',
        message: 'Failed to start 2FA enrollment',
      });
    } finally {
      setEnrolling(false);
    }
  }, [showFeedback]);

  const handleVerifyEnrollment = useCallback(async () => {
    if (!enrollment || !verificationCode.trim()) {
      showFeedback({
        type: 'error',
        message: 'Please enter the 6-digit code from your authenticator app',
      });
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyTwoFactorEnrollment(enrollment.id, verificationCode.trim());

      if (!result.success) {
        showFeedback({
          type: 'error',
          message: result.error || 'Invalid code. Please try again.',
        });
        return;
      }

      showFeedback({
        type: 'success',
        message: '2FA enabled successfully!',
      });

      // Close modal and reload status
      setShowEnrollModal(false);
      setEnrollment(null);
      setVerificationCode('');
      await loadTwoFactorStatus();
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      showFeedback({
        type: 'error',
        message: 'Verification failed. Please try again.',
      });
    } finally {
      setVerifying(false);
    }
  }, [enrollment, verificationCode, showFeedback, loadTwoFactorStatus]);

  const handleDisable = useCallback(
    async (factorId: string) => {
      Alert.alert(
        'Disable Two-Factor Authentication?',
        'Are you sure you want to disable 2FA? Your account will be less secure.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await unenrollTwoFactor(factorId);

                if (!result.success) {
                  showFeedback({
                    type: 'error',
                    message: result.error || 'Failed to disable 2FA',
                  });
                  return;
                }

                showFeedback({
                  type: 'success',
                  message: '2FA disabled successfully',
                });

                await loadTwoFactorStatus();
              } catch (error) {
                console.error('Failed to disable 2FA:', error);
                showFeedback({
                  type: 'error',
                  message: 'Failed to disable 2FA',
                });
              }
            },
          },
        ]
      );
    },
    [showFeedback, loadTwoFactorStatus]
  );

  const handleCancelEnrollment = useCallback(() => {
    setShowEnrollModal(false);
    setEnrollment(null);
    setVerificationCode('');
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <SectionHeading
          title="Two-Factor Authentication"
          subtitle="Add an extra layer of security"
          titleColor={theme.colors.textPrimary}
          subtitleColor={theme.colors.textSecondary}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <SectionHeading
          title="Two-Factor Authentication"
          subtitle="Add an extra layer of security"
          titleColor={theme.colors.textPrimary}
          subtitleColor={theme.colors.textSecondary}
        />

        <View style={styles.statusRow}>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusLabel, { color: theme.colors.textPrimary }]}>
              Status
            </Text>
            <View style={styles.statusBadgeContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: twoFactorEnabled ? theme.colors.success : theme.colors.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: twoFactorEnabled ? theme.colors.success : theme.colors.textMuted },
                ]}
              >
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>

        {twoFactorEnabled && factors.length > 0 && (
          <View style={styles.factorsList}>
            {factors.map(factor => (
              <View
                key={factor.id}
                style={[
                  styles.factorItem,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.factorInfo}>
                  <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
                  <View style={styles.factorTextContainer}>
                    <Text style={[styles.factorName, { color: theme.colors.textPrimary }]}>
                      {factor.friendlyName}
                    </Text>
                    <Text style={[styles.factorType, { color: theme.colors.textSecondary }]}>
                      Authenticator App (TOTP)
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleDisable(factor.id)}
                  style={({ pressed }) => [
                    styles.disableButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.disableButtonText, { color: theme.colors.error }]}>
                    Disable
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {!twoFactorEnabled && (
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
            ]}
          >
            <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Two-factor authentication adds an extra layer of security by requiring a code from
              your authenticator app in addition to your password.
            </Text>
          </View>
        )}

        {!twoFactorEnabled && (
          <PrimaryButton
            title={enrolling ? 'Starting...' : 'Enable Two-Factor Authentication'}
            onPress={handleEnableClick}
            loading={enrolling}
            disabled={enrolling}
            backgroundColor={theme.colors.primary}
            textColor={theme.colors.surface}
          />
        )}
      </View>

      {/* Enrollment Modal */}
      <Modal
        visible={showEnrollModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelEnrollment}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <KeyboardDismissibleView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Enable Two-Factor Authentication
              </Text>
              <Pressable onPress={handleCancelEnrollment}>
                <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View
                  style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={[styles.stepNumberText, { color: theme.colors.surface }]}>1</Text>
                </View>
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                  Scan QR Code
                </Text>
              </View>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan
                this QR code:
              </Text>

              {enrollment && (
                <View style={[styles.qrCodeContainer, { backgroundColor: theme.colors.surface }]}>
                  <QRCode value={enrollment.uri} size={200} />
                </View>
              )}

              <Text style={[styles.orText, { color: theme.colors.textMuted }]}>
                Or enter this code manually:
              </Text>
              <View
                style={[
                  styles.secretContainer,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[styles.secretText, { color: theme.colors.textPrimary }]}
                  selectable
                >
                  {enrollment?.secret}
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View
                  style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={[styles.stepNumberText, { color: theme.colors.surface }]}>2</Text>
                </View>
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                  Enter Verification Code
                </Text>
              </View>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Enter the 6-digit code from your authenticator app:
              </Text>

              <TextInput
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="000000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={[
                  styles.codeInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              />
            </View>

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={handleCancelEnrollment}
                backgroundColor={theme.colors.surface}
                textColor={theme.colors.textPrimary}
                borderColor={theme.colors.border}
              />
              <PrimaryButton
                title={verifying ? 'Verifying...' : 'Verify & Enable'}
                onPress={handleVerifyEnrollment}
                loading={verifying}
                disabled={verifying || verificationCode.length !== 6}
                backgroundColor={theme.colors.primary}
                textColor={theme.colors.surface}
              />
            </View>
          </KeyboardDismissibleView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTextContainer: {
    gap: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  factorsList: {
    gap: 12,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  factorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  factorTextContainer: {
    flex: 1,
    gap: 4,
  },
  factorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  factorType: {
    fontSize: 14,
  },
  disableButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disableButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
    gap: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  stepContainer: {
    gap: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
  },
  orText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  secretContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secretText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
