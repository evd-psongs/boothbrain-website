import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { resetPassword, loading, error, clearError } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const displayError = localError || error;

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Enter your email address.');
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await resetPassword(trimmedEmail);
      setSubmitted(true);
      setTimeout(() => router.replace('/auth/sign-in'), 1500);
    } catch (err) {
      console.error('Reset password failed', err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>We’ll send you a link to create a new password.</Text>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (displayError) {
                clearError();
                setLocalError(null);
              }
            }}
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

        {displayError ? (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.error }]}>
            <Text style={[styles.errorText, { color: theme.colors.surface }]}>{displayError}</Text>
          </View>
        ) : null}

        {submitted ? (
          <Text style={[styles.successText, { color: theme.colors.success }]}>Email sent! Check your inbox.</Text>
        ) : null}

        <Pressable
          style={[styles.button, { backgroundColor: theme.colors.primary, opacity: loading ? 0.8 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.surface} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.surface }]}>Send reset email</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: 20,
  },
  title: {
    fontSize: 24,
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
  successText: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
