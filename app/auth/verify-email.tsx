import { useEffect, useMemo, useRef, useState } from 'react';
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

  const CODE_LENGTH = 6;
  const [digits, setDigits] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ''));
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputsRef = useRef<Array<TextInput | null>>([]);

  const targetEmail = useMemo(() => {
    if (typeof params.email === 'string' && params.email.trim().length) {
      return params.email.trim();
    }
    return session?.user?.email ?? '';
  }, [params.email, session?.user?.email]);

  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (!loading && session?.user?.email_confirmed_at) {
      router.replace('/(tabs)/home');
    }
  }, [loading, session?.user?.email_confirmed_at, router]);

  const handleVerify = async () => {
    if (!targetEmail) {
      setLocalError('Missing email address. Please register again.');
      return;
    }

    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length !== CODE_LENGTH) {
      setLocalError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
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

      setInfoMessage('Email verified! Taking you to your dashboard…');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message = err?.message ?? 'Failed to verify code. Please try again.';
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '');

    if (sanitized.length > 1) {
      const clipped = sanitized.slice(0, CODE_LENGTH);
      const nextDigits = Array.from({ length: CODE_LENGTH }, () => '');
      clipped.split('').forEach((char, idx) => {
        nextDigits[idx] = char;
      });
      setDigits(nextDigits);
      if (clipped.length >= CODE_LENGTH) {
        inputsRef.current[CODE_LENGTH - 1]?.blur();
      } else {
        inputsRef.current[clipped.length]?.focus();
      }
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });

    if (sanitized.length === 0) {
      return;
    }

    if (index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    } else {
      inputsRef.current[index]?.blur();
    }
  };

  const handleDigitKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') return;

    if (digits[index]) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    for (let i = index - 1; i >= 0; i -= 1) {
      if (digits[i]) {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = '';
          return next;
        });
        inputsRef.current[i]?.focus();
        return;
      }
      if (i === index - 1) {
        inputsRef.current[i]?.focus();
        return;
      }
    }
  };

  const renderCodeInputs = () =>
    digits.map((digit, idx) => (
      <TextInput
        key={`code-${idx}`}
        ref={(ref) => {
          inputsRef.current[idx] = ref;
        }}
        value={digit}
        onChangeText={(text) => handleDigitChange(idx, text)}
        onFocus={() => setFocusedIndex(idx)}
        onBlur={() => setFocusedIndex((current) => (current === idx ? null : current))}
        onKeyPress={({ nativeEvent }) => handleDigitKeyPress(idx, nativeEvent.key)}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType={idx === CODE_LENGTH - 1 ? 'done' : 'next'}
        maxLength={1}
        style={[
          styles.codeInput,
          {
            borderColor: focusedIndex === idx ? theme.colors.primary : theme.colors.border,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
        textAlign="center"
        autoFocus={idx === 0}
        importantForAutofill="yes"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        editable={!submitting}
        accessibilityLabel={`Verification code digit ${idx + 1}`}
        accessible
      />
    ));

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
            <View style={styles.codeRow}>{renderCodeInputs()}</View>
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
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignSelf: 'center',
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    width: 44,
    height: 56,
    fontSize: 20,
    fontWeight: '600',
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
