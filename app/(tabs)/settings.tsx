import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { startCheckoutSession, openBillingPortal } from '@/lib/billing';
import { updateProfile } from '@/lib/profile';
import { deleteUserSetting, fetchUserSettings, setUserSetting } from '@/lib/settings';
import { pauseSubscription, resumeSubscription } from '@/lib/subscriptions';
import { useSession } from '@/providers/SessionProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { formatCurrencyFromCents } from '@/utils/currency';
import type { SubscriptionPlan } from '@/types/auth';
import { enforceFreePlanLimits, FREE_PLAN_ITEM_LIMIT } from '@/lib/freePlanLimits';
import { PAUSE_ALREADY_USED_MESSAGE } from '@/utils/pauseErrors';
import * as ImagePicker from 'expo-image-picker';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

type PaymentField = 'squareLink' | 'venmoUsername' | 'cashAppTag' | 'paypalQrUri';

type PaymentValues = Record<PaymentField, string>;

type PaymentFieldConfig = {
  field: PaymentField;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
};

const PAYMENT_FIELDS: PaymentField[] = ['squareLink', 'venmoUsername', 'cashAppTag', 'paypalQrUri'];

const PAYMENT_CONFIG: PaymentFieldConfig[] = [
  {
    field: 'squareLink',
    label: 'Square checkout link',
    placeholder: 'https://square.link/...',
    keyboardType: 'url',
  },
  {
    field: 'venmoUsername',
    label: 'Venmo username',
    placeholder: '@yourname',
  },
  {
    field: 'cashAppTag',
    label: 'Cash App tag',
    placeholder: '$yourtag',
  },
];

const DEFAULT_PAYMENT_VALUES: PaymentValues = {
  squareLink: '',
  venmoUsername: '',
  cashAppTag: '',
  paypalQrUri: '',
};

const FALLBACK_PRO_PLAN: SubscriptionPlan = {
  id: 'fallback-pro-plan',
  name: 'Pro',
  tier: 'pro',
  maxInventoryItems: 500,
  priceCents: 2700,
  currency: 'USD',
  billingIntervalMonths: 3,
};

function formatStatus(status?: string | null) {
  if (!status) return 'Active';
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function calculateDaysRemaining(targetDateIso: string | null): number | null {
  if (!targetDateIso) return null;
  const target = new Date(targetDateIso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatSessionCode(code: string): string {
  if (!code) return '';
  const normalized = code.toUpperCase();
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

function formatJoinCodeInput(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

function stripJoinCodeFormatting(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.priceCents == null) {
    return 'Contact us';
  }

  const amount = formatCurrencyFromCents(plan.priceCents, plan.currency);
  if (plan.billingIntervalMonths && plan.billingIntervalMonths > 1) {
    const months = plan.billingIntervalMonths;
    if (months === 3) {
      return `${amount} every 3 months`;
    }
    if (months === 12) {
      return `${amount} per year`;
    }
    return `${amount} every ${months} months`;
  }

  return `${amount} / month`;
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  placeholderColor: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

function InputField({
  label,
  value,
  onChange,
  placeholder,
  placeholderColor,
  borderColor,
  backgroundColor,
  textColor,
  keyboardType,
  secureTextEntry,
  textContentType,
  autoCapitalize,
}: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: placeholderColor }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        style={[styles.input, { borderColor, backgroundColor, color: textColor }]}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function FeedbackBanner({
  feedback,
  successColor,
  errorColor,
}: {
  feedback: FeedbackState;
  successColor: string;
  errorColor: string;
}) {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (feedback && currentFeedback !== feedback) {
      setCurrentFeedback(feedback);
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(-16);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          mass: 0.8,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!feedback && currentFeedback) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentFeedback(null);
        translateY.setValue(-16);
      });
    }
  }, [feedback, currentFeedback, opacity, translateY]);

  if (!currentFeedback) return null;
  const isSuccess = currentFeedback.type === 'success';
  const palette = isSuccess ? successColor : errorColor;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.feedbackToast,
        { backgroundColor: palette, borderColor: palette },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.feedbackText, { color: '#fff' }]}>{currentFeedback.message}</Text>
    </Animated.View>
  );
}

function SectionHeading({ title, subtitle, titleColor, subtitleColor }: {
  title: string;
  subtitle: string;
  titleColor: string;
  subtitleColor: string;
}) {
  return (
    <View>
      <Text style={[styles.cardTitle, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  backgroundColor,
  textColor,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.primaryButtonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
  disabled,
  loading,
  backgroundColor,
  borderColor,
  textColor,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        style,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.secondaryButtonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, signOut, updatePassword, refreshSession, loading } = useSupabaseAuth();
  const {
    currentSession,
    createSession,
    joinSession,
    endSession,
    clearError,
    loading: sessionLoading,
    error: sessionError,
  } = useSession();
  const router = useRouter();
  const {
    data: plansData,
    isLoading: plansLoading,
    isFetching: plansFetching,
  } = useSubscriptionPlans();
  const normalizedPlans = useMemo<SubscriptionPlan[]>(
    () => {
      const base = plansData && plansData.length ? plansData : [FALLBACK_PRO_PLAN];
      return base
        .filter((plan) => plan.tier === 'pro')
        .map((plan) => ({
          ...plan,
          priceCents: 2700,
          currency: 'USD',
          billingIntervalMonths: 3,
        }));
    },
    [plansData],
  );

  const [fullName, setFullName] = useState(user?.profile?.fullName ?? '');
  const [phone, setPhone] = useState(user?.profile?.phone ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingPasswordState, setUpdatingPasswordState] = useState(false);
  const [refreshingAccount, setRefreshingAccount] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSession, setJoiningSession] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [paymentValues, setPaymentValues] = useState<PaymentValues>(DEFAULT_PAYMENT_VALUES);
  const [initialPaymentValues, setInitialPaymentValues] = useState<PaymentValues>(DEFAULT_PAYMENT_VALUES);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [launchingCheckout, setLaunchingCheckout] = useState(false);
  const [checkoutPlanTier, setCheckoutPlanTier] = useState<string | null>(null);
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
  const [managingPause, setManagingPause] = useState(false);
  const [uploadingPaypalQr, setUploadingPaypalQr] = useState(false);

  useEffect(() => {
    setFullName(user?.profile?.fullName ?? '');
    setPhone(user?.profile?.phone ?? '');
  }, [user?.profile?.fullName, user?.profile?.phone]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (feedback) {
      timeout = setTimeout(() => setFeedback(null), 4000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [feedback]);

  useEffect(() => {
    if (!user?.id) {
      setPaymentValues(DEFAULT_PAYMENT_VALUES);
      setInitialPaymentValues(DEFAULT_PAYMENT_VALUES);
      setLoadingPayments(false);
      return;
    }

    let isCancelled = false;
    setLoadingPayments(true);

    const loadSettings = async () => {
      try {
        const result = await fetchUserSettings(user.id, PAYMENT_FIELDS);
        if (isCancelled) return;
        const normalized = PAYMENT_FIELDS.reduce<PaymentValues>((acc, key) => {
          acc[key] = (result[key] ?? '').trim();
          return acc;
        }, { ...DEFAULT_PAYMENT_VALUES });
        setPaymentValues(normalized);
        setInitialPaymentValues(normalized);
      } catch (error: any) {
        if (isCancelled) return;
        console.error('Failed to load payment settings', error);
        setFeedback({ type: 'error', message: error?.message ?? 'Failed to load payment settings.' });
      } finally {
        if (!isCancelled) setLoadingPayments(false);
      }
    };

    void loadSettings();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  const subscription = user?.subscription ?? null;
  const currentPlanTier = subscription?.plan?.tier ?? 'free';
  const isSubscriptionPaused = Boolean(subscription?.pausedAt);
  const pauseAllowanceUsed = Boolean(subscription?.pauseAllowanceUsed);
  const trialDaysRemaining = useMemo(() => calculateDaysRemaining(subscription?.trialEndsAt ?? null), [
    subscription?.trialEndsAt,
  ]);

  const planName = useMemo(() => {
    if (isSubscriptionPaused) return 'Free';
    if (subscription?.plan?.name) return subscription.plan.name;
    if (currentPlanTier) return formatStatus(currentPlanTier);
    return 'Free';
  }, [subscription?.plan, currentPlanTier, isSubscriptionPaused]);

  const priceDescription = subscription?.plan ? formatPlanPrice(subscription.plan) : null;

  const subscriptionDetails = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    rows.push({ label: 'Plan tier', value: planName });
    if (priceDescription) {
      rows.push({ label: 'Price', value: priceDescription });
    }
    if (subscription?.currentPeriodEnd) {
      rows.push({ label: 'Renews', value: new Date(subscription.currentPeriodEnd).toLocaleDateString() });
    }
    if (trialDaysRemaining !== null) {
      rows.push({
        label: 'Trial',
        value: trialDaysRemaining > 0 ? `${trialDaysRemaining} days remaining` : 'Ends today',
      });
    }
    return rows;
  }, [planName, priceDescription, subscription?.currentPeriodEnd, trialDaysRemaining]);
  const canManagePause = Boolean(subscription?.id && currentPlanTier !== 'free');
  const pauseRestrictionMessage = useMemo(() => {
    if (!pauseAllowanceUsed || isSubscriptionPaused) return null;
    if (subscription?.currentPeriodEnd) {
      return `You can pause again after ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}.`;
    }
    return 'You can pause again after your next billing date.';
  }, [pauseAllowanceUsed, isSubscriptionPaused, subscription?.currentPeriodEnd]);
  const availablePlans = useMemo(
    () => normalizedPlans.filter((plan) => plan.tier !== currentPlanTier),
    [normalizedPlans, currentPlanTier],
  );
  const canOpenBillingPortal = Boolean(subscription?.id);
  const showPlansSpinner = (plansLoading || plansFetching) && !(plansData && plansData.length);
  const showFreeLimitNotice = currentPlanTier === 'free' || isSubscriptionPaused;

  const profileDirty = useMemo(() => {
    const initialName = user?.profile?.fullName ?? '';
    const initialPhone = user?.profile?.phone ?? '';
    return fullName !== initialName || phone !== initialPhone;
  }, [fullName, phone, user?.profile?.fullName, user?.profile?.phone]);

  const paymentsDirty = useMemo(
    () => PAYMENT_FIELDS.some((field) => paymentValues[field] !== initialPaymentValues[field]),
    [paymentValues, initialPaymentValues],
  );

  const joinCodeReady = useMemo(() => stripJoinCodeFormatting(joinCode).length === 6, [joinCode]);

  const passwordValid = useMemo(() => {
    if (!newPassword || !confirmPassword) return false;
    if (newPassword !== confirmPassword) return false;
    return newPassword.length >= 8;
  }, [newPassword, confirmPassword]);

  const showFeedback = useCallback((state: FeedbackState) => {
    setFeedback(state);
  }, []);

  const handleJoinCodeChange = useCallback(
    (value: string) => {
      clearError();
      setJoinCode(formatJoinCodeInput(value));
    },
    [clearError],
  );

  const handleCreateSession = useCallback(async () => {
    if (!user?.id) return;
    setCreatingSession(true);
    clearError();
    try {
      const session = await createSession();
      setShowJoinForm(false);
      showFeedback({
        type: 'success',
        message: `Session created: ${formatSessionCode(session.code)}`,
      });
    } catch (error: any) {
      console.error('Failed to create session', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to create session.' });
    } finally {
      setCreatingSession(false);
    }
  }, [user?.id, createSession, clearError, showFeedback]);

  const handleJoinSession = useCallback(async () => {
    if (!user?.id) return;
    const normalized = stripJoinCodeFormatting(joinCode);
    if (normalized.length !== 6) {
      showFeedback({ type: 'error', message: 'Enter a valid 6 character code to join.' });
      return;
    }
    setJoiningSession(true);
    clearError();
    try {
      await joinSession(normalized);
      setJoinCode('');
      setShowJoinForm(false);
      showFeedback({
        type: 'success',
        message: `Joined session ${formatSessionCode(normalized)}.`,
      });
    } catch (error: any) {
      console.error('Failed to join session', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to join session.' });
    } finally {
      setJoiningSession(false);
    }
  }, [user?.id, joinCode, joinSession, clearError, showFeedback]);

  const handleShareSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      await Share.share({
        title: 'BoothBrain session code',
        message: `Join my BoothBrain session with code ${formatSessionCode(currentSession.code)}.`,
      });
    } catch (error: any) {
      console.error('Failed to share session code', error);
      showFeedback({ type: 'error', message: 'Unable to share session code.' });
    }
  }, [currentSession, showFeedback]);

  const handleSelectPlan = useCallback(
    async (planTier: string) => {
      if (!user?.id) return;
      setLaunchingCheckout(true);
      setCheckoutPlanTier(planTier);
      try {
        await startCheckoutSession({
          planTier,
          userId: user.id,
        });
        showFeedback({ type: 'success', message: 'Checkout opened. Complete the upgrade in your browser.' });
      } catch (error: any) {
        console.error('Failed to start checkout session', error);
        showFeedback({ type: 'error', message: error?.message ?? 'Failed to start checkout session.' });
      } finally {
        setLaunchingCheckout(false);
        setCheckoutPlanTier(null);
      }
    },
    [user?.id, showFeedback],
  );

  const handleOpenBillingPortal = useCallback(async () => {
    if (!user?.id || !canOpenBillingPortal) return;
    setOpeningBillingPortal(true);
    try {
      await openBillingPortal({ userId: user.id });
      showFeedback({ type: 'success', message: 'Billing portal opened in your browser.' });
    } catch (error: any) {
      console.error('Failed to open billing portal', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to open billing portal.' });
    } finally {
      setOpeningBillingPortal(false);
    }
  }, [user?.id, canOpenBillingPortal, showFeedback]);

  const applyPauseState = useCallback(
    async (mode: 'pause' | 'resume') => {
      if (!user?.id || !canManagePause) return;
      if (mode === 'pause' && pauseAllowanceUsed && !isSubscriptionPaused) {
        showFeedback({ type: 'error', message: PAUSE_ALREADY_USED_MESSAGE });
        return;
      }
      setManagingPause(true);
      try {
        if (mode === 'resume') {
          await resumeSubscription(user.id);
          showFeedback({ type: 'success', message: 'Subscription resumed.' });
        } else {
          await pauseSubscription(user.id);
          const { removedInventory, removedStaged } = await enforceFreePlanLimits(user.id);

          let notice = 'Subscription paused. Your account now matches the Free plan limits.';
          const removalParts: string[] = [];
          if (removedInventory > 0) {
            removalParts.push(`${removedInventory} inventory item${removedInventory === 1 ? '' : 's'}`);
          }
          if (removedStaged > 0) {
            removalParts.push(`${removedStaged} staged item${removedStaged === 1 ? '' : 's'}`);
          }
          if (removalParts.length) {
            notice = `${notice} Removed ${removalParts.join(' and ')}.`;
          }
          showFeedback({ type: 'success', message: notice });
        }
        await refreshSession();
      } catch (error: any) {
        console.error('Failed to update subscription pause state', error);
        showFeedback({ type: 'error', message: error?.message ?? 'Failed to update subscription.' });
      } finally {
        setManagingPause(false);
      }
    },
    [user?.id, canManagePause, pauseAllowanceUsed, isSubscriptionPaused, refreshSession, showFeedback],
  );

  const handleManagePause = useCallback(() => {
    if (!user?.id || !canManagePause) return;

    if (isSubscriptionPaused) {
      void applyPauseState('resume');
      return;
    }

    if (pauseAllowanceUsed) {
      Alert.alert('Pause unavailable', PAUSE_ALREADY_USED_MESSAGE);
      return;
    }

    Alert.alert(
      'Pause subscription?',
      `Pausing will downgrade you to the Free plan. Only your ${FREE_PLAN_ITEM_LIMIT} most recent items will remain and the rest will be permanently removed. Export or back up your inventory before continuing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause subscription',
          style: 'destructive',
          onPress: () => {
            void applyPauseState('pause');
          },
        },
      ],
    );
  }, [user?.id, canManagePause, isSubscriptionPaused, pauseAllowanceUsed, applyPauseState]);

  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      await refreshSession();
      showFeedback({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error: any) {
      console.error('Failed to update profile', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  }, [user?.id, fullName, phone, refreshSession, showFeedback]);

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

  const handleRefreshSubscription = useCallback(async () => {
    setRefreshingAccount(true);
    try {
      await refreshSession();
      showFeedback({ type: 'success', message: 'Subscription refreshed.' });
    } catch (error: any) {
      console.error('Failed to refresh subscription', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to refresh subscription.' });
    } finally {
      setRefreshingAccount(false);
    }
  }, [refreshSession, showFeedback]);

  const handleSavePaymentSettings = useCallback(async () => {
    if (!user?.id || !paymentsDirty) return;
    setSavingPayments(true);
    try {
      const userId = user.id;
      const trimmedValues = PAYMENT_FIELDS.reduce<PaymentValues>((acc, field) => {
        const rawValue = paymentValues[field];
        acc[field] = field === 'paypalQrUri' ? rawValue : rawValue.trim();
        return acc;
      }, { ...DEFAULT_PAYMENT_VALUES });

      const operations = PAYMENT_FIELDS.reduce<Promise<void>[]>((acc, field) => {
        const value = trimmedValues[field];
        const initialValue = initialPaymentValues[field].trim();
        if (value === initialValue) return acc;
        if (!value) {
          acc.push(deleteUserSetting(userId, field));
        } else {
          acc.push(setUserSetting(userId, field, value));
        }
        return acc;
      }, []);

      if (operations.length) {
        await Promise.all(operations);
      }

      setPaymentValues(trimmedValues);
      setInitialPaymentValues(trimmedValues);
      showFeedback({ type: 'success', message: 'Payment preferences saved.' });
    } catch (error: any) {
      console.error('Failed to save payment settings', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to save payment settings.' });
    } finally {
      setSavingPayments(false);
    }
  }, [user?.id, paymentsDirty, paymentValues, initialPaymentValues, showFeedback]);

  const handleSetPaymentField = useCallback((field: PaymentField, value: string) => {
    setPaymentValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleUploadPaypalQr = useCallback(async () => {
    try {
      setUploadingPaypalQr(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showFeedback({ type: 'error', message: 'Enable photo access to upload a QR code.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        showFeedback({ type: 'error', message: 'Unable to process the selected image.' });
        return;
      }

      const mimeType =
        (asset as { mimeType?: string }).mimeType
        ?? (asset.uri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      setPaymentValues((prev) => ({ ...prev, paypalQrUri: dataUrl }));
    } catch (error: any) {
      console.error('Failed to upload PayPal QR', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to upload QR code.' });
    } finally {
      setUploadingPaypalQr(false);
    }
  }, [showFeedback]);

  const handleRemovePaypalQr = useCallback(() => {
    setPaymentValues((prev) => ({ ...prev, paypalQrUri: '' }));
  }, []);

  const handleClearSession = useCallback(async () => {
    if (!currentSession) return;
    setClearingSession(true);
    clearError();
    try {
      await endSession();
      setJoinCode('');
      setShowJoinForm(false);
      showFeedback({ type: 'success', message: 'Session cleared.' });
    } catch (error: any) {
      console.error('Failed to clear session', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to clear session.' });
    } finally {
      setClearingSession(false);
    }
  }, [currentSession, endSession, clearError, showFeedback]);

  const handleContactSupport = useCallback(() => {
    const email = 'hello@boothbrain.com';
    const subject = encodeURIComponent('BoothBrain Support');
    const url = `mailto:${email}?subject=${subject}`;
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open mail client', err);
      showFeedback({ type: 'error', message: 'Unable to open mail client.' });
    });
  }, [showFeedback]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOut();
            router.replace('/');
          })();
        },
      },
    ]);
  }, [signOut, router]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }] }>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Settings Unavailable</Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Sign in to manage your BoothBrain account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }] }>
      <FeedbackBanner feedback={feedback} successColor={theme.colors.success} errorColor={theme.colors.error} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: theme.colors.textPrimary }]}>Settings</Text>
          <Text style={[styles.screenSubtitle, { color: theme.colors.textSecondary }]}>Manage your account details, subscription, and payment preferences.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <SectionHeading
            title="Sessions"
            subtitle="Sync inventory across devices by creating a shared session or joining with a code."
            titleColor={theme.colors.textPrimary}
            subtitleColor={theme.colors.textSecondary}
          />

          {currentSession ? (
            <>
              <Text style={[styles.sessionHint, { color: theme.colors.textSecondary }]}>
                {currentSession.isHost
                  ? 'You are hosting this session. Share the code with teammates to let them connect.'
                  : 'You are connected to a shared session from another device.'}
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Session code</Text>
                <Text style={[styles.sessionCode, { color: theme.colors.textPrimary }]}>
                  {formatSessionCode(currentSession.code)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Role</Text>
                <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>
                  {currentSession.isHost ? 'Host' : 'Participant'}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Created</Text>
                <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>
                  {new Date(currentSession.createdAt).toLocaleString()}
                </Text>
              </View>

              {currentSession.isHost ? (
                <View style={styles.buttonSpacing}>
                  <SecondaryButton
                    title="Share code"
                    onPress={handleShareSession}
                    backgroundColor="transparent"
                    borderColor={theme.colors.primary}
                    textColor={theme.colors.primary}
                  />
                </View>
              ) : null}

              <View style={styles.buttonSpacing}>
                <PrimaryButton
                  title="Clear session"
                  onPress={handleClearSession}
                  disabled={clearingSession || sessionLoading}
                  loading={clearingSession || sessionLoading}
                  backgroundColor={theme.colors.error}
                  textColor={theme.colors.surface}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sessionHint, { color: theme.colors.textSecondary }]}>
                Create a session to broadcast inventory updates, or join one that’s already in progress.
              </Text>

              <PrimaryButton
                title="Create session"
                onPress={handleCreateSession}
                disabled={creatingSession || sessionLoading}
                loading={creatingSession || sessionLoading}
                backgroundColor={theme.colors.primary}
                textColor={theme.colors.surface}
              />

              {showJoinForm ? (
                <>
                  <InputField
                    label="Join code"
                    value={joinCode}
                    onChange={handleJoinCodeChange}
                    placeholder="ABC-123"
                    placeholderColor={theme.colors.textMuted}
                    borderColor={theme.colors.border}
                    backgroundColor={theme.colors.surface}
                    textColor={theme.colors.textPrimary}
                    autoCapitalize="characters"
                  />

                  <PrimaryButton
                    title="Confirm join"
                    onPress={handleJoinSession}
                    disabled={!joinCodeReady || joiningSession || sessionLoading}
                    loading={joiningSession || sessionLoading}
                    backgroundColor={theme.colors.secondary}
                    textColor={theme.colors.surface}
                  />

                  <PrimaryButton
                    title="Cancel"
                    onPress={() => {
                      clearError();
                      setShowJoinForm(false);
                      setJoinCode('');
                    }}
                    backgroundColor={theme.colors.surfaceMuted}
                    textColor={theme.colors.textPrimary}
                  />
                </>
              ) : (
                <PrimaryButton
                  title="Join session"
                  onPress={() => {
                    clearError();
                    setShowJoinForm(true);
                  }}
                  backgroundColor={theme.colors.secondary}
                  textColor={theme.colors.surface}
                />
              )}
            </>
          )}

          {sessionError ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{sessionError}</Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
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

          <InputField
            label="Phone number"
            value={phone}
            onChange={setPhone}
            placeholder="Mobile number"
            placeholderColor={theme.colors.textMuted}
            borderColor={theme.colors.border}
            backgroundColor={theme.colors.surface}
            textColor={theme.colors.textPrimary}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
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

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
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

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <View style={styles.cardHeaderRow}>
            <View style={styles.subscriptionHeadingGroup}>
              <SectionHeading
                title="Subscription"
                subtitle={`You're on the ${planName} plan.`}
                titleColor={theme.colors.textPrimary}
                subtitleColor={theme.colors.textSecondary}
              />
              {showFreeLimitNotice ? (
                <Text style={[styles.freeLimitNotice, { color: theme.colors.textSecondary }]}>
                  {isSubscriptionPaused
                    ? `While paused, only your ${FREE_PLAN_ITEM_LIMIT} most recent items are kept.`
                    : `Free accounts can track up to ${FREE_PLAN_ITEM_LIMIT} total items across inventory and staging.`}
                </Text>
              ) : null}
            </View>
          </View>

          {isSubscriptionPaused ? (
            <View style={[styles.notice, { backgroundColor: 'rgba(255, 196, 61, 0.12)', borderColor: theme.colors.warning }]}>
              <Text style={[styles.noticeText, { color: theme.colors.warning }]}>Billing is paused. Resume to restore premium features.</Text>
            </View>
          ) : null}

          {subscriptionDetails.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>{row.value}</Text>
            </View>
          ))}

          <View style={styles.inlineActions}>
            <SecondaryButton
              style={styles.inlineActionButton}
              title="Open billing portal"
              onPress={handleOpenBillingPortal}
              disabled={!canOpenBillingPortal || openingBillingPortal}
              loading={openingBillingPortal}
              backgroundColor="transparent"
              borderColor={theme.colors.primary}
              textColor={theme.colors.primary}
            />
            <SecondaryButton
              style={[styles.inlineActionButton, styles.inlineActionButtonLast]}
              title="Refresh subscription"
              onPress={handleRefreshSubscription}
              disabled={refreshingAccount}
              loading={refreshingAccount}
              backgroundColor={theme.colors.surfaceMuted}
              borderColor={theme.colors.border}
              textColor={theme.colors.textPrimary}
            />
          </View>

          {canManagePause ? (
            <View
              style={[styles.pauseCard, {
                borderColor: theme.colors.warning,
                backgroundColor: 'rgba(247, 181, 0, 0.12)',
              }]}
            >
              <Text style={[styles.pauseTitle, { color: theme.colors.textPrimary }]}>Pause subscription</Text>
              <Text style={[styles.pauseBody, { color: theme.colors.textSecondary }]}>
                Need a break between markets? Pause your Pro plan once per billing cycle and we will hold your data until you resume.
              </Text>
              {pauseRestrictionMessage ? (
                <Text style={[styles.pauseRestriction, { color: theme.colors.textSecondary }]}>
                  {pauseRestrictionMessage}
                </Text>
              ) : null}
              <PrimaryButton
                title={isSubscriptionPaused ? 'Resume subscription' : 'Pause subscription'}
                onPress={handleManagePause}
                disabled={managingPause || (!isSubscriptionPaused && pauseAllowanceUsed)}
                loading={managingPause}
                backgroundColor={isSubscriptionPaused ? theme.colors.success : theme.colors.warning}
                textColor={isSubscriptionPaused ? theme.colors.surface : theme.colors.textPrimary}
              />
            </View>
          ) : null}

          {availablePlans.length ? (
            <View style={styles.planList}>
              <Text style={[styles.planSectionTitle, { color: theme.colors.textSecondary }]}>Upgrade to Pro</Text>
              {showPlansSpinner ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading plans…</Text>
                </View>
              ) : (
                availablePlans.map((plan) => {
                  const priceLabel = formatPlanPrice(plan);
                  const isSelecting = launchingCheckout && checkoutPlanTier === plan.tier;
                  return (
                    <View
                      key={plan.id}
                      style={[styles.planCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                    >
                      <Text style={[styles.planTitle, { color: theme.colors.textPrimary }]}>{plan.name}</Text>
                      <Text style={[styles.planDescription, { color: theme.colors.textSecondary }]}>For high-volume vendors needing more tools and flexibility, with one seasonal pause included.</Text>
                      <Text style={[styles.planPrice, { color: theme.colors.textPrimary }]}>{priceLabel}</Text>
                      <View style={styles.planButtonSpacing}>
                        <PrimaryButton
                          title="Upgrade"
                          onPress={() => handleSelectPlan(plan.tier)}
                          disabled={launchingCheckout}
                          loading={isSelecting}
                          backgroundColor={theme.colors.primary}
                          textColor={theme.colors.surface}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <SectionHeading
            title="Payment preferences"
            subtitle="Store quick links for customers when using your POS."
            titleColor={theme.colors.textPrimary}
            subtitleColor={theme.colors.textSecondary}
          />

          {loadingPayments ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading payment links…</Text>
            </View>
          ) : (
            <>
              {PAYMENT_CONFIG.map((config) => (
                <InputField
                  key={config.field}
                  label={config.label}
                  value={paymentValues[config.field]}
                  onChange={(value) => handleSetPaymentField(config.field, value)}
                  placeholder={config.placeholder}
                  placeholderColor={theme.colors.textMuted}
                  borderColor={theme.colors.border}
                  backgroundColor={theme.colors.surface}
                  textColor={theme.colors.textPrimary}
                  keyboardType={config.keyboardType}
                  autoCapitalize="none"
                />
              ))}

              <View style={styles.paypalSection}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>PayPal QR code</Text>
                <Text style={[styles.paypalHelpText, { color: theme.colors.textMuted }]}>Upload a QR code image so shoppers can scan and pay with PayPal.</Text>
                <View
                  style={[
                    styles.paypalPreview,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  {paymentValues.paypalQrUri ? (
                    <Image source={{ uri: paymentValues.paypalQrUri }} style={styles.paypalImage} resizeMode="contain" />
                  ) : (
                    <Text style={[styles.paypalPlaceholder, { color: theme.colors.textMuted }]}>No QR code uploaded yet.</Text>
                  )}
                </View>

                <View style={styles.paypalActions}>
                <Pressable
                  onPress={handleUploadPaypalQr}
                  disabled={uploadingPaypalQr}
                  style={({ pressed }) => [
                    styles.paypalUploadButton,
                    {
                      borderColor: theme.colors.primary,
                      backgroundColor: pressed ? theme.colors.primary : 'transparent',
                    },
                    uploadingPaypalQr ? { opacity: 0.6 } : null,
                  ]}
                >
                  {uploadingPaypalQr ? (
                    <ActivityIndicator color={theme.colors.surface} />
                  ) : (
                    <>
                      <Text style={[styles.paypalUploadText, { color: theme.colors.primary }]}>
                        {paymentValues.paypalQrUri ? 'Replace QR code' : 'Upload QR code'}
                      </Text>
                      <Text style={[styles.paypalUploadHint, { color: theme.colors.textMuted }]}>
                        PNG or JPG, crop before saving.
                      </Text>
                    </>
                  )}
                </Pressable>
                {paymentValues.paypalQrUri ? (
                  <SecondaryButton
                    style={styles.paypalRemoveButton}
                    title="Remove QR code"
                    onPress={handleRemovePaypalQr}
                    disabled={uploadingPaypalQr}
                    loading={false}
                    backgroundColor={theme.colors.surface}
                    borderColor={theme.colors.border}
                    textColor={theme.colors.textPrimary}
                  />
                ) : null}
              </View>
            </View>

              <PrimaryButton
                title="Save payment links"
                onPress={handleSavePaymentSettings}
                disabled={!paymentsDirty || savingPayments}
                loading={savingPayments}
                backgroundColor={theme.colors.primaryDark}
                textColor={theme.colors.surface}
              />
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <SectionHeading
            title="Need help?"
            subtitle="We typically respond within one business day."
            titleColor={theme.colors.textPrimary}
            subtitleColor={theme.colors.textSecondary}
          />

          <PrimaryButton
            title="Contact support"
            onPress={handleContactSupport}
            backgroundColor={theme.colors.secondary}
            textColor={theme.colors.surface}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }] }>
          <SectionHeading
            title="Sign out"
            subtitle="Signing out removes your session data from this device."
            titleColor={theme.colors.error}
            subtitleColor={theme.colors.textSecondary}
          />

          <PrimaryButton
            title="Sign out"
            onPress={handleSignOut}
            backgroundColor={theme.colors.error}
            textColor={theme.colors.surface}
          />
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 16,
  },
  header: {
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '600',
  },
  screenSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
  },
  feedbackToast: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardSubtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  inlineActionButton: {
    flex: 1,
    marginRight: 12,
    marginBottom: 12,
    minWidth: '48%',
  },
  inlineActionButtonLast: {
    marginRight: 0,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  sessionHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  sessionCode: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  buttonSpacing: {
    marginTop: 12,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
  },
  planSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  planList: {
    marginTop: 20,
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  planButtonSpacing: {
    marginTop: 12,
  },
  pauseCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 16,
  },
  pauseTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pauseBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  pauseRestriction: {
    fontSize: 12,
    lineHeight: 18,
  },
  freeLimitNotice: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  subscriptionHeadingGroup: {
    flex: 1,
  },
  paypalSection: {
    marginTop: 8,
    gap: 12,
  },
  paypalHelpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  paypalPreview: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  paypalPlaceholder: {
    fontSize: 13,
  },
  paypalImage: {
    width: '100%',
    height: 180,
  },
  paypalActions: {
    width: '100%',
  },
  paypalUploadButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  paypalUploadText: {
    fontSize: 15,
    fontWeight: '600',
  },
  paypalUploadHint: {
    fontSize: 12,
    marginTop: 4,
  },
  paypalRemoveButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
