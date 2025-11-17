import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { Link, useRouter } from 'expo-router';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';

const logoImage = require('../../assets/icon.png') as number;

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { signIn, loading, error, clearError } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const displayError = localError || error;

  const handleSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setLocalError('Enter your email and password to continue.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await signIn({ email: trimmedEmail, password });
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Sign in failed', err);
    }
  }, [email, password, signIn, router, clearError]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.logoContainer}>
            <Image
              source={logoImage}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Sign in to continue managing your booth.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
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
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
          </View>

          {displayError ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error }]}>
              <Text style={[styles.errorText, { color: theme.colors.surface }]}>{displayError}</Text>
            </View>
          ) : null}

          <Link href="/auth/reset-password" asChild>
            <Text style={[styles.forgotPassword, { color: theme.colors.primary }]}>Forgot password?</Text>
          </Link>

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.8 : 1 },
            ]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.colors.surface }]}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>New to BoothBrain?</Text>
            <Link href="/auth/sign-up" asChild>
              <Text style={[styles.footerLink, { color: theme.colors.primary }]}>Create account</Text>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  errorBox: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  forgotPassword: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '500',
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
