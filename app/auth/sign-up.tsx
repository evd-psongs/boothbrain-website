import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { EMAIL_IN_USE_MESSAGE, mapSupabaseSignUpError } from '@/utils/authErrors';

export default function SignUpScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { signUp, loading, error, clearError } = useSupabaseAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const displayError = localError || error;
  const emailError = displayError === EMAIL_IN_USE_MESSAGE ? displayError : null;
  const globalError = displayError && displayError !== emailError ? displayError : null;

  const handleSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedEmail || !trimmedPassword || !trimmedConfirm) {
      setLocalError('Fill in all required fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    if (trimmedPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        fullName: fullName.trim() || undefined,
      });
      router.replace({ pathname: '/auth/verify-email', params: { email: trimmedEmail } });
    } catch (err) {
      const friendly = mapSupabaseSignUpError(err);
      setLocalError(friendly);
    }
  }, [email, password, confirmPassword, fullName, signUp, router, clearError]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Start tracking sessions and inventory in minutes.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jordan Booth"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              style={[
                styles.input,
                { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(value) => {
                if (displayError === EMAIL_IN_USE_MESSAGE) {
                  clearError();
                  setLocalError(null);
                }
                setEmail(value);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                {
                  borderColor: emailError ? theme.colors.error : theme.colors.border,
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            />
            {emailError ? <Text style={[styles.errorInline, { color: theme.colors.error }]}>{emailError}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password</Text>
              <Text
                style={[styles.toggle, { color: theme.colors.primary }]}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Confirm password</Text>
              <Text
                style={[styles.toggle, { color: theme.colors.primary }]}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </Text>
            </View>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
          </View>

          {globalError ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error }]}>
              <Text style={[styles.errorText, { color: theme.colors.surface }]}>{globalError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.8 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.colors.surface }]}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Already have an account?</Text>
            <Link href="/auth/sign-in" asChild>
              <Text style={[styles.footerLink, { color: theme.colors.primary }]}>Sign in</Text>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    gap: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorInline: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  errorBox: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
