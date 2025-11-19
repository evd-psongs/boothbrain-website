import { useCallback, useState, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  isBiometricAvailable,
  getBiometricType,
  authenticateWithBiometrics,
  type BiometricType
} from '@/utils/biometrics';
import { getBiometricPreference } from '@/utils/biometricPreferences';
import { supabase } from '@/lib/supabase';

const logoImage = require('../../assets/BBtrans.png') as number;

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { signIn, loading, error, clearError } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [canUseBiometricLogin, setCanUseBiometricLogin] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const displayError = localError || error;

  // Load saved email and check biometric availability on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load saved email
        const savedEmail = await AsyncStorage.getItem('@booth_brain_saved_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }

        // Check biometric availability
        const [available, type, preference] = await Promise.all([
          isBiometricAvailable(),
          getBiometricType(),
          getBiometricPreference(),
        ]);

        setBiometricType(type);

        // Check if user has a valid session (for biometric login)
        const { data: { session } } = await supabase.auth.getSession();

        // Can use biometric login if:
        // 1. Biometrics are available and enabled
        // 2. User has a valid saved session (required for token refresh)
        const canUseBiometric = available && preference && !!session;
        setCanUseBiometricLogin(canUseBiometric);
      } catch (error) {
        console.error('Failed to initialize login screen:', error);
      }
    };
    void initialize();
  }, []);

  const handleBiometricSignIn = useCallback(async () => {
    setBiometricLoading(true);
    setLocalError(null);
    clearError();

    try {
      // Prompt for biometric authentication
      const result = await authenticateWithBiometrics();

      if (!result.success) {
        setLocalError(result.error || 'Biometric authentication failed');
        setBiometricLoading(false);
        return;
      }

      // Check if we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setLocalError('No saved session found. Please sign in with your password.');
        setBiometricLoading(false);
        return;
      }

      // Refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        setLocalError('Session expired. Please sign in with your password.');
        setBiometricLoading(false);
        return;
      }

      // Success! Navigate to home
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Biometric sign in failed', err);
      setLocalError('Failed to sign in. Please try again.');
    } finally {
      setBiometricLoading(false);
    }
  }, [router, clearError]);

  const handleSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setLocalError('Enter your email and password to continue.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      // Save or clear email based on Remember Me toggle
      if (rememberMe) {
        await AsyncStorage.setItem('@booth_brain_saved_email', trimmedEmail);
      } else {
        await AsyncStorage.removeItem('@booth_brain_saved_email');
      }

      await signIn({ email: trimmedEmail, password });
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Sign in failed', err);
    }
  }, [email, password, rememberMe, signIn, router, clearError]);

  return (
    <LinearGradient
      colors={['#0575E6', '#021B79']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.logoContainer}>
              <Image
                source={logoImage}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Welcome back</Text>

            {canUseBiometricLogin && (
              <>
                <Pressable
                  style={[
                    styles.biometricButton,
                    { backgroundColor: theme.colors.primary, opacity: biometricLoading ? 0.8 : 1 },
                  ]}
                  onPress={handleBiometricSignIn}
                  disabled={biometricLoading || loading}
                >
                  {biometricLoading ? (
                    <ActivityIndicator color={theme.colors.surface} />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          biometricType === 'facial'
                            ? 'scan'
                            : biometricType === 'fingerprint'
                              ? 'finger-print'
                              : 'shield-checkmark'
                        }
                        size={24}
                        color={theme.colors.surface}
                      />
                      <Text style={[styles.biometricButtonText, { color: theme.colors.surface }]}>
                        Sign in with Biometrics
                      </Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>
                    Or continue with password
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                </View>
              </>
            )}

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

          <View style={styles.rememberMeRow}>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.surface}
              ios_backgroundColor={theme.colors.border}
            />
            <Text style={[styles.rememberMeText, { color: theme.colors.textSecondary }]}>
              Remember me
            </Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
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
    borderRadius: 24,
    padding: 32,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  biometricButton: {
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#0575E6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  biometricButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
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
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  rememberMeText: {
    fontSize: 15,
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
  forgotPassword: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 12,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0575E6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
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
