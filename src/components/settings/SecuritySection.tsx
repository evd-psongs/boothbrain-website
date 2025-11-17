import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { SectionHeading, type FeedbackState } from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';
import {
  isBiometricAvailable,
  getBiometricType,
  type BiometricType,
} from '@/utils/biometrics';
import { getBiometricPreference, setBiometricPreference } from '@/utils/biometricPreferences';

type SecuritySectionProps = {
  theme: Theme;
  showFeedback: (state: FeedbackState) => void;
};

export function SecuritySection({ theme, showFeedback }: SecuritySectionProps) {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Check biometric availability and load preference on mount
  useEffect(() => {
    const loadBiometricSettings = async () => {
      setLoading(true);
      try {
        const [available, type, enabled] = await Promise.all([
          isBiometricAvailable(),
          getBiometricType(),
          getBiometricPreference(),
        ]);
        setBiometricAvailable(available);
        setBiometricType(type);
        setBiometricEnabled(enabled);
      } catch (error) {
        console.error('Failed to load biometric settings:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadBiometricSettings();
  }, []);

  const handleToggleBiometric = useCallback(
    async (value: boolean) => {
      setUpdating(true);
      try {
        await setBiometricPreference(value);
        setBiometricEnabled(value);
        showFeedback({
          type: 'success',
          message: value
            ? 'Biometric authentication enabled'
            : 'Biometric authentication disabled',
        });
      } catch (error) {
        console.error('Failed to update biometric preference:', error);
        showFeedback({
          type: 'error',
          message: 'Failed to update biometric settings',
        });
      } finally {
        setUpdating(false);
      }
    },
    [showFeedback]
  );

  const getBiometricLabel = (): string => {
    if (biometricType === 'facial') return 'Face ID';
    if (biometricType === 'fingerprint') return 'Touch ID / Fingerprint';
    if (biometricType === 'iris') return 'Iris Scan';
    return 'Biometric Authentication';
  };

  const getBiometricDescription = (): string => {
    if (!biometricAvailable) {
      return 'Biometric authentication is not available on this device or not enrolled.';
    }
    return 'Require biometric authentication when opening the app for enhanced security.';
  };

  if (loading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <SectionHeading
          title="Security"
          subtitle="Manage your security preferences"
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
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <SectionHeading
        title="Security"
        subtitle="Manage your security preferences"
        titleColor={theme.colors.textPrimary}
        subtitleColor={theme.colors.textSecondary}
      />

      <View style={styles.settingRow}>
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingLabel, { color: theme.colors.textPrimary }]}>
            {getBiometricLabel()}
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            {getBiometricDescription()}
          </Text>
        </View>
        <Switch
          value={biometricEnabled}
          onValueChange={handleToggleBiometric}
          disabled={!biometricAvailable || updating}
          trackColor={{
            false: theme.colors.border,
            true: theme.colors.primary,
          }}
          thumbColor={theme.colors.surface}
          ios_backgroundColor={theme.colors.border}
        />
      </View>

      {!biometricAvailable && (
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            To use biometric authentication, please enable Face ID, Touch ID, or Fingerprint in
            your device settings and enroll your biometric data.
          </Text>
        </View>
      )}
    </View>
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  settingTextContainer: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
