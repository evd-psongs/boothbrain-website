import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  PrimaryButton,
  SectionHeading,
  InputField,
} from '@/components/common';
import { updateProfile } from '@/lib/profile';
import type { Theme } from '@/providers/ThemeProvider';

interface ProfileSectionProps {
  theme: Theme;
  user: {
    id: string;
    email: string | null;
    profile?: {
      fullName?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  refreshSession: () => Promise<void>;
  showFeedback: (state: { type: 'success' | 'error'; message: string }) => void;
}

export function ProfileSection({ theme, user, refreshSession, showFeedback }: ProfileSectionProps) {
  const [fullName, setFullName] = useState(user?.profile?.fullName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setFullName(user?.profile?.fullName ?? '');
  }, [user?.profile?.fullName]);

  const profileDirty = useMemo(() => {
    const initialName = user?.profile?.fullName ?? '';
    return fullName !== initialName;
  }, [fullName, user?.profile?.fullName]);

  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        fullName: fullName.trim() || null,
      });
      await refreshSession();
      showFeedback({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error: any) {
      console.error('Failed to update profile', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  }, [user?.id, fullName, refreshSession, showFeedback]);

  if (!user) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <SectionHeading
        title="Profile"
        subtitle="Keep your contact information up to date so your team can reach you."
        titleColor={theme.colors.textPrimary}
        subtitleColor={theme.colors.textSecondary}
      />

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Email</Text>
        <View style={[styles.readOnlyField, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
          <Text style={[styles.readOnlyText, { color: theme.colors.textPrimary }]}>{user.email ?? '—'}</Text>
        </View>
      </View>

      <InputField
        label="Full name"
        value={fullName}
        onChange={setFullName}
        placeholder="Your name"
        placeholderColor={theme.colors.textMuted}
        borderColor={theme.colors.border}
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.textPrimary}
        autoCapitalize="words"
      />

      <PrimaryButton
        title="Save profile"
        onPress={handleSaveProfile}
        disabled={!profileDirty || savingProfile}
        loading={savingProfile}
        backgroundColor={theme.colors.primary}
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
    gap: 20,
  },
  inputGroup: {
    // marginBottom removed as card gap handles spacing
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  readOnlyField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyText: {
    fontSize: 16,
  },
});