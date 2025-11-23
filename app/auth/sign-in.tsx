import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Pressable,
  Image,
  Switch,
  Modal,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { KeyboardDismissibleView } from '@/components/common';
import {
  getAssuranceLevel,
  getTwoFactorFactors,
  challengeTwoFactor,
  verifyTwoFactorCode,
} from '@/utils/twoFactor';

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

  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const displayError = localError || error;

  // Load saved email on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@booth_brain_saved_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Failed to load saved email:', error);
      }
    };
    void initialize();
  }, []);

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

      const { error } = await signIn({ email: trimmedEmail, password });

      if (error) throw error;

      // Check if user needs 2FA
      const assurance = await getAssuranceLevel();

      if (assurance.nextLevel === 'aal2') {
        // User has 2FA enabled and needs to verify
        const factorsResult = await getTwoFactorFactors();

        if (factorsResult.success && factorsResult.factors && factorsResult.factors.length > 0) {
          const verifiedFactor = factorsResult.factors.find(f => f.status === 'verified');

          if (verifiedFactor) {
            // Create a challenge for this factor
            const challengeResult = await challengeTwoFactor(verifiedFactor.id);

            if (challengeResult.success && challengeResult.challengeId) {
              setFactorId(verifiedFactor.id);
              setChallengeId(challengeResult.challengeId);
              setShow2FAModal(true);
              return; // Don't navigate yet, wait for 2FA verification
            }
          }
        }
      }

      // No 2FA required or 2FA setup failed, proceed to home
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Sign in failed', err);
    }
  }, [email, password, rememberMe, signIn, router, clearError]);

  const handleVerify2FA = useCallback(async () => {
    if (!factorId || !challengeId || !twoFactorCode.trim()) {
      setLocalError('Please enter your 6-digit code');
      return;
    }

    setVerifying2FA(true);
    setLocalError(null);
    clearError();

    try {
      const result = await verifyTwoFactorCode(factorId, challengeId, twoFactorCode.trim());

      if (!result.success) {
        setLocalError(result.error || 'Invalid code. Please try again.');
        setVerifying2FA(false);
        return;
      }

      // 2FA verified successfully, proceed to home
      setShow2FAModal(false);
      setTwoFactorCode('');
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('2FA verification failed', err);
      setLocalError('Verification failed. Please try again.');
    } finally {
      setVerifying2FA(false);
    }
  }, [factorId, challengeId, twoFactorCode, router, clearError]);

  const handleCancel2FA = useCallback(() => {
    setShow2FAModal(false);
    setTwoFactorCode('');
    setFactorId(null);
    setChallengeId(null);
    setLocalError(null);
  }, []);

  return (
    <LinearGradient
      colors={['#0575E6', '#021B79']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardDismissibleView useScrollView={false} style={styles.container}>
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
      </KeyboardDismissibleView>

      {/* 2FA Verification Modal */}
      <Modal
        visible={show2FAModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel2FA}
      >
        <KeyboardDismissibleView
          useScrollView={false}
          style={[styles.twoFactorModal, { backgroundColor: theme.colors.background }]}
        >
          <View style={styles.twoFactorModal}>
            <View style={styles.twoFactorHeader}>
              <Text style={[styles.twoFactorTitle, { color: theme.colors.textPrimary }]}>
                Two-Factor Authentication
              </Text>
              <Pressable onPress={handleCancel2FA}>
                <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.twoFactorContent}>
              <View style={[styles.twoFactorIconContainer, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="shield-checkmark" size={48} color={theme.colors.surface} />
              </View>

              <Text style={[styles.twoFactorDescription, { color: theme.colors.textSecondary }]}>
                Enter the 6-digit code from your authenticator app to complete sign in.
              </Text>

              <TextInput
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                placeholder="000000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerify2FA}
                blurOnSubmit
                style={[
                  styles.twoFactorInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              />

              {displayError && (
                <View style={[styles.errorBox, { backgroundColor: theme.colors.error }]}>
                  <Text style={[styles.errorText, { color: theme.colors.surface }]}>
                    {displayError}
                  </Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.twoFactorButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: verifying2FA || twoFactorCode.length !== 6 ? 0.5 : 1,
                  },
                ]}
                onPress={handleVerify2FA}
                disabled={verifying2FA || twoFactorCode.length !== 6}
              >
                {verifying2FA ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <Text style={[styles.twoFactorButtonText, { color: theme.colors.surface }]}>
                    Verify
                  </Text>
                )}
              </Pressable>

              <Pressable onPress={handleCancel2FA} style={styles.cancelButton}>
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardDismissibleView>
      </Modal>
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
  twoFactorModal: {
    flex: 1,
    padding: 20,
  },
  twoFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 20,
  },
  twoFactorTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  twoFactorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  twoFactorIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoFactorDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  twoFactorInput: {
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 12,
  },
  twoFactorButton: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  twoFactorButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
