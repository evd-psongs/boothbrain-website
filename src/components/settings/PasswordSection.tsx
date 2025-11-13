import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  PrimaryButton,
  SectionHeading,
  InputField,
} from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';

interface PasswordSectionProps {
  theme: Theme;
  updatePassword: (newPassword: string) => Promise<void>;
  showFeedback: (state: { type: 'success' | 'error'; message: string }) => void;
}

export function PasswordSection({ theme, updatePassword, showFeedback }: PasswordSectionProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPasswordState, setUpdatingPasswordState] = useState(false);

  const passwordValid = useMemo(() => {
    if (!newPassword || !confirmPassword) return false;
    if (newPassword !== confirmPassword) return false;
    return newPassword.length >= 8;
  }, [newPassword, confirmPassword]);

  const handleUpdatePassword = useCallback(async () => {
    if (!passwordValid) {
      showFeedback({ type: 'error', message: 'Passwords must match and be at least 8 characters.' });
      return;
    }
    setUpdatingPasswordState(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showFeedback({ type: 'success', message: 'Password updated successfully.' });
    } catch (error: any) {
      console.error('Failed to update password', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to update password.' });
    } finally {
      setUpdatingPasswordState(false);
    }
  }, [passwordValid, updatePassword, newPassword, showFeedback]);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <SectionHeading
        title="Password"
        subtitle="Choose a strong password with at least 8 characters."
        titleColor={theme.colors.textPrimary}
        subtitleColor={theme.colors.textSecondary}
      />

      <InputField
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        placeholder="New password"
        placeholderColor={theme.colors.textMuted}
        borderColor={theme.colors.border}
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.textPrimary}
        secureTextEntry
        textContentType="newPassword"
        autoCapitalize="none"
      />

      <InputField
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Confirm password"
        placeholderColor={theme.colors.textMuted}
        borderColor={theme.colors.border}
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.textPrimary}
        secureTextEntry
        textContentType="password"
        autoCapitalize="none"
      />

      <PrimaryButton
        title="Update password"
        onPress={handleUpdatePassword}
        disabled={!passwordValid || updatingPasswordState}
        loading={updatingPasswordState}
        backgroundColor={theme.colors.secondary}
        textColor={theme.colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
});