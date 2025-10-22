import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session, loading, error, clearError } = useSupabaseAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const targetEmail = useMemo(() => {
    if (typeof params.email === 'string' && params.email.trim().length) {
      return params.email.trim();
    }
    return session?.user?.email ?? '';
  }, [params.email, session?.user?.email]);

  useEffect(() => {
    if (!loading && session?.user?.email_confirmed_at) {
      router.replace('/auth/sign-in');
    }
  }, [loading, session?.user?.email_confirmed_at, router]);

  const handleVerify = async () => {
    if (!targetEmail) {
      setLocalError('Missing email address. Please register again.');
      return;
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setLocalError('Enter the 6-digit code from your email.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    setInfoMessage(null);
    clearError();

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: trimmedCode,
        type: 'signup',
      });

      if (verifyError) {
        throw verifyError;
      }

      setInfoMessage('Email verified! You can sign in now.');
      router.replace('/auth/sign-in');
    } catch (err: any) {
      const message = err?.message ?? 'Failed to verify code. Please try again.';
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!targetEmail) {
      setLocalError('Missing email address. Please register again.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    setInfoMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
      });

      if (resendError) {
        throw resendError;
      }

      setInfoMessage('A new code has been sent to your email.');
    } catch (err: any) {
      const message = err?.message ?? 'Failed to resend code. Please try again.';
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !targetEmail) {
    return <Redirect href="/auth/sign-up" />;
  }

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Verify your email</Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Enter the 6-digit code we sent to</Text>
          <Text style={[styles.email, { color: theme.colors.textPrimary }]}>{targetEmail || 'your email address'}</Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Verification code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={6}
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
              editable={!submitting}
            />
          </View>

          {displayError ? (
            <View style={[styles.alert, { backgroundColor: theme.colors.error }]}>
              <Text style={[styles.alertText, { color: theme.colors.surface }]}>{displayError}</Text>
            </View>
          ) : null}

          {infoMessage ? (
            <View style={[styles.alert, { backgroundColor: theme.colors.secondary }]}>
              <Text style={[styles.alertText, { color: theme.colors.surface }]}>{infoMessage}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary, opacity: submitting ? 0.8 : 1 }]}
            onPress={handleVerify}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.colors.surface }]}>Verify code</Text>
            )}
          </Pressable>

          <Pressable style={styles.resendButton} onPress={handleResend} disabled={submitting}>
            <Text style={[styles.resendText, { color: theme.colors.primary }]}>Resend code</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Already confirmed?</Text>
            <Link href="/auth/sign-in" asChild>
              <Text style={[styles.footerLink, { color: theme.colors.primary }]}>Return to sign in</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
  },
  alert: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
