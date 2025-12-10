import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  FeedbackBanner,
  type FeedbackState,
} from '@/components/common';
import { SessionManagementSection } from '@/components/settings/SessionManagementSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { PasswordSection } from '@/components/settings/PasswordSection';
import { TwoFactorSection } from '@/components/settings/TwoFactorSection';
import { PaymentSettingsSection } from '@/components/settings/PaymentSettingsSection';
import { SubscriptionModal } from '@/components/modals';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { startCheckoutSession } from '@/lib/billing';
import { supabase } from '@/lib/supabase';
import { useSession, SESSION_CODE_LENGTH } from '@/providers/SessionProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { formatCurrencyFromCents } from '@/utils/currency';
import type { SubscriptionPlan } from '@/types/auth';
import { getErrorMessage } from '@/types/database';
import { FREE_PLAN_ITEM_LIMIT } from '@/lib/freePlanLimits';
import { isProSubscriptionAvailable, getProUnavailableMessage, isAndroid } from '@/utils/platform';
import { testCrash } from '@/lib/services/firebase';
import Constants from 'expo-constants';


type PendingJoinRequest = {
  id: string;
  participantUserId: string;
  participantName: string;
  participantEmail: string;
  requestedAt: string;
  deviceId: string | undefined;
};

type SecurityOverview = {
  sessionCode: string;
  pendingRequests: number;
  recentFailedAttempts: number;
  recentRateLimited: number;
  lastFailedAttempt: string | undefined;
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

const SESSION_CODE_GROUP_SIZE = 4;
const MIN_SESSION_PASSPHRASE_LENGTH = 8;

function stripJoinCodeFormatting(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatSessionCode(code: string): string {
  const normalized = stripJoinCodeFormatting(code);
  if (!normalized) return '';
  const matcher = normalized.match(new RegExp(`.{1,${SESSION_CODE_GROUP_SIZE}}`, 'g'));
  return matcher ? matcher.join('-') : normalized;
}

function formatJoinCodeInput(value: string): string {
  const cleaned = stripJoinCodeFormatting(value).slice(0, SESSION_CODE_LENGTH);
  const matcher = cleaned.match(new RegExp(`.{1,${SESSION_CODE_GROUP_SIZE}}`, 'g'));
  return matcher ? matcher.join('-') : cleaned;
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

  const [refreshingAccount, setRefreshingAccount] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSession, setJoiningSession] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [sessionPassphrase, setSessionPassphrase] = useState('');
  const [joinPassphrase, setJoinPassphrase] = useState('');
  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([]);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(false);
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null);
  const [loadingSecurityOverview, setLoadingSecurityOverview] = useState(false);
  const [resolvingRequest, setResolvingRequest] = useState<{ id: string; mode: 'approve' | 'deny' } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [launchingCheckout, setLaunchingCheckout] = useState(false);
  const [checkoutPlanTier, setCheckoutPlanTier] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (feedback) {
      timeout = setTimeout(() => setFeedback(null), 4000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [feedback]);

  const subscription = user?.subscription ?? null;
  const currentPlanTier = subscription?.plan?.tier ?? 'free';
  const trialDaysRemaining = useMemo(() => calculateDaysRemaining(subscription?.trialEndsAt ?? null), [
    subscription?.trialEndsAt,
  ]);

  const planName = useMemo(() => {
    if (subscription?.plan?.name) return subscription.plan.name;
    if (currentPlanTier) return formatStatus(currentPlanTier);
    return 'Free';
  }, [subscription?.plan, currentPlanTier]);

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
  const availablePlans = useMemo(
    () => normalizedPlans.filter((plan) => plan.tier !== currentPlanTier),
    [normalizedPlans, currentPlanTier],
  );
  const showPlansSpinner = (plansLoading || plansFetching) && !(plansData && plansData.length);
  const showFreeLimitNotice = currentPlanTier === 'free';

  const joinCodeReady = useMemo(
    () => stripJoinCodeFormatting(joinCode).length === SESSION_CODE_LENGTH,
    [joinCode],
  );

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

  const loadSecurityOverview = useCallback(async () => {
    if (!currentSession?.isHost) {
      setSecurityOverview(null);
      return;
    }
    setLoadingSecurityOverview(true);
    try {
      const { data, error } = await supabase.rpc('get_session_security_overview', {
        target_session_code: currentSession.code,
      });
      if (error) {
        throw error;
      }
      const row = (Array.isArray(data) ? data[0] : data) ?? null;
      if (!row) {
        setSecurityOverview(null);
        return;
      }
      setSecurityOverview({
        sessionCode: row.session_code,
        pendingRequests: row.pending_requests ?? 0,
        recentFailedAttempts: row.recent_failed_attempts ?? 0,
        recentRateLimited: row.recent_rate_limited ?? 0,
        lastFailedAttempt: row.last_failed_attempt || undefined,
      });
    } catch (error) {
      console.error('Failed to load security overview', error);
    } finally {
      setLoadingSecurityOverview(false);
    }
  }, [currentSession?.code, currentSession?.isHost]);

  const loadPendingRequests = useCallback(async () => {
    if (!currentSession?.isHost) {
      setPendingRequests([]);
      return;
    }
    setLoadingPendingRequests(true);
    try {
      const { data, error } = await supabase.rpc('list_pending_session_requests', {
        target_session_code: currentSession.code,
      });
      if (error) {
        throw error;
      }
      const rows = Array.isArray(data) ? data : [];
      const normalized: PendingJoinRequest[] = rows.map((row: any) => ({
        id: row.id,
        participantUserId: row.participant_user_id,
        participantName: row.participant_name ? String(row.participant_name) : 'Teammate',
        participantEmail: row.participant_email ?? '',
        requestedAt: row.requested_at,
        deviceId: row.device_id || undefined,
      }));
      setPendingRequests(normalized);
    } catch (error) {
      console.error('Failed to load pending join requests', error);
      showFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setLoadingPendingRequests(false);
    }
  }, [currentSession?.code, currentSession?.isHost, showFeedback]);

  useEffect(() => {
    if (!currentSession?.isHost) {
      setPendingRequests([]);
      setSecurityOverview(null);
      return;
    }
    void loadPendingRequests();
    void loadSecurityOverview();
  }, [currentSession?.code, currentSession?.isHost, loadPendingRequests, loadSecurityOverview]);

  const handleCreateSession = useCallback(async () => {
    if (!user?.id) return;
    const trimmedPassphrase = sessionPassphrase.trim();
    if (trimmedPassphrase.length > 0 && trimmedPassphrase.length < MIN_SESSION_PASSPHRASE_LENGTH) {
      showFeedback({
        type: 'error',
        message: `Passphrases must be at least ${MIN_SESSION_PASSPHRASE_LENGTH} characters.`,
      });
      return;
    }
    setCreatingSession(true);
    clearError();
    try {
      const session = await createSession({
        passphrase: trimmedPassphrase,
        approvalRequired: true,
      });
      setShowJoinForm(false);
      setSessionPassphrase('');
      showFeedback({
        type: 'success',
        message: `Session created: ${formatSessionCode(session.code)}`,
      });
    } catch (error) {
      console.error('Failed to create session', error);
      showFeedback({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setCreatingSession(false);
    }
  }, [user?.id, createSession, sessionPassphrase, clearError, showFeedback]);

  const handleJoinSession = useCallback(async () => {
    if (!user?.id) return;
    const normalized = stripJoinCodeFormatting(joinCode);
    if (normalized.length !== SESSION_CODE_LENGTH) {
      showFeedback({
        type: 'error',
        message: `Enter a valid ${SESSION_CODE_LENGTH} character code to join.`,
      });
      return;
    }
    const trimmedPassphrase = joinPassphrase.trim();
    if (trimmedPassphrase.length > 0 && trimmedPassphrase.length < MIN_SESSION_PASSPHRASE_LENGTH) {
      showFeedback({
        type: 'error',
        message: `Passphrases must be at least ${MIN_SESSION_PASSPHRASE_LENGTH} characters.`,
      });
      return;
    }
    setJoiningSession(true);
    clearError();
    try {
      const result = await joinSession(normalized, { passphrase: trimmedPassphrase });
      if (result.status === 'approved' && result.session) {
        setJoinCode('');
        setJoinPassphrase('');
        setShowJoinForm(false);
        showFeedback({
          type: 'success',
          message: `Joined session ${formatSessionCode(normalized)}.`,
        });
      } else {
        showFeedback({
          type: 'success',
          message: result.message ?? 'Join request sent. Waiting for host approval.',
        });
      }
    } catch (error: any) {
      console.error('Failed to join session', error);
      showFeedback({ type: 'error', message: error?.message ?? 'Failed to join session.' });
    } finally {
      setJoiningSession(false);
    }
  }, [user?.id, joinCode, joinPassphrase, joinSession, clearError, showFeedback]);

  const handleResolveRequest = useCallback(
    async (requestId: string, mode: 'approve' | 'deny') => {
      if (!currentSession?.isHost) return;
      clearError();
      setResolvingRequest({ id: requestId, mode });
      try {
        const { error } = await supabase.rpc('resolve_session_join_request', {
          membership_id: requestId,
          approve: mode === 'approve',
          note: mode === 'deny' ? 'denied_by_host' : null,
        });
        if (error) {
          throw error;
        }
        showFeedback({
          type: 'success',
          message: mode === 'approve' ? 'Participant approved.' : 'Join request denied.',
        });
        await Promise.all([loadPendingRequests(), loadSecurityOverview()]);
      } catch (error: any) {
        console.error('Failed to resolve join request', error);
        showFeedback({
          type: 'error',
          message: error?.message ?? 'Unable to update join request.',
        });
      } finally {
        setResolvingRequest(null);
      }
    },
    [currentSession?.isHost, clearError, loadPendingRequests, loadSecurityOverview, showFeedback],
  );

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

  const handleClearSession = useCallback(async () => {
    if (!currentSession) return;
    setClearingSession(true);
    clearError();
    try {
      await endSession();
      setJoinCode('');
      setShowJoinForm(false);
      setJoinPassphrase('');
      setSessionPassphrase('');
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

  const handleTestCrash = useCallback(() => {
    Alert.alert(
      'Test Crashlytics',
      'This will force a crash to test Firebase Crashlytics reporting. The app will close immediately.\n\nOnly use this in EAS builds (not Expo Go).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: () => {
            console.log('🔴 Triggering test crash for Crashlytics...');
            testCrash();
          },
        },
      ],
    );
  }, []);

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

        <SessionManagementSection
          theme={theme}
          currentSession={currentSession}
          sessionLoading={sessionLoading}
          sessionError={sessionError}
          sessionPassphrase={sessionPassphrase}
          setSessionPassphrase={setSessionPassphrase}
          creatingSession={creatingSession}
          handleCreateSession={handleCreateSession}
          showJoinForm={showJoinForm}
          setShowJoinForm={setShowJoinForm}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          joinPassphrase={joinPassphrase}
          setJoinPassphrase={setJoinPassphrase}
          joinCodeReady={joinCodeReady}
          joiningSession={joiningSession}
          handleJoinSession={handleJoinSession}
          handleJoinCodeChange={handleJoinCodeChange}
          clearingSession={clearingSession}
          handleClearSession={handleClearSession}
          handleShareSession={handleShareSession}
          clearError={clearError}
          securityOverview={securityOverview || undefined}
          loadingSecurityOverview={loadingSecurityOverview}
          loadSecurityOverview={loadSecurityOverview}
          pendingRequests={pendingRequests}
          loadingPendingRequests={loadingPendingRequests}
          loadPendingRequests={loadPendingRequests}
          resolvingRequest={resolvingRequest || undefined}
          handleResolveRequest={handleResolveRequest}
        />

        <ProfileSection
          theme={theme}
          user={user ? { ...user, email: user.email ?? null } : null}
          refreshSession={refreshSession}
          showFeedback={showFeedback}
        />

        <PasswordSection
          theme={theme}
          updatePassword={updatePassword}
          showFeedback={showFeedback}
        />

        <TwoFactorSection
          theme={theme}
          showFeedback={showFeedback}
        />

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
                  Free accounts can track up to {FREE_PLAN_ITEM_LIMIT} total items across inventory and staging.
                </Text>
              ) : null}
            </View>
          </View>

          {subscriptionDetails.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>{row.value}</Text>
            </View>
          ))}

          <SecondaryButton
            title="Refresh"
            onPress={handleRefreshSubscription}
            disabled={refreshingAccount}
            loading={refreshingAccount}
            backgroundColor={theme.colors.surfaceMuted}
            borderColor={theme.colors.border}
            textColor={theme.colors.textPrimary}
          />

          {subscription?.paymentPlatform === 'apple' ? (
            <View style={[styles.notice, { backgroundColor: 'rgba(99, 102, 241, 0.08)', borderColor: theme.colors.primary }]}>
              <Text style={[styles.noticeText, { color: theme.colors.textPrimary }]}>
                To manage your subscription, go to iOS Settings → [Your Name] → Subscriptions
              </Text>
            </View>
          ) : null}

          {!isProSubscriptionAvailable() && currentPlanTier === 'free' ? (
            <View style={[styles.comingSoonCard, {
              borderColor: theme.colors.primary,
              backgroundColor: 'rgba(99, 102, 241, 0.08)'
            }]}>
              <Text style={[styles.comingSoonTitle, { color: theme.colors.primary }]}>
                Pro Subscriptions Coming Soon
              </Text>
              <Text style={[styles.comingSoonMessage, { color: theme.colors.textSecondary }]}>
                {getProUnavailableMessage()}
              </Text>
              {isAndroid && (
                <Text style={[styles.comingSoonEta, { color: theme.colors.textMuted }]}>
                  Expected availability: 1-2 months
                </Text>
              )}
            </View>
          ) : isProSubscriptionAvailable() && currentPlanTier === 'free' ? (
            <View style={styles.planList}>
              <Text style={[styles.planSectionTitle, { color: theme.colors.textSecondary }]}>Upgrade to Pro</Text>
              <View style={[styles.planCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                <Text style={[styles.planTitle, { color: theme.colors.textPrimary }]}>BoothBrain Pro</Text>
                <Text style={[styles.planDescription, { color: theme.colors.textSecondary }]}>
                  Up to 500 items, vendor collaboration tools, and priority support
                </Text>
                <Text style={[styles.planPrice, { color: theme.colors.textPrimary }]}>Starting at $29.99/quarter</Text>
                <View style={styles.planButtonSpacing}>
                  <PrimaryButton
                    title="View Plans"
                    onPress={() => setShowSubscriptionModal(true)}
                    backgroundColor={theme.colors.primary}
                    textColor={theme.colors.surface}
                  />
                </View>
              </View>
            </View>
          ) : availablePlans.length ? (
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

        <PaymentSettingsSection
          theme={theme}
          userId={user?.id}
          showFeedback={showFeedback}
        />

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

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <SectionHeading
            title="About"
            subtitle="Learn more about BoothBrain and our privacy practices."
            titleColor={theme.colors.textPrimary}
            subtitleColor={theme.colors.textSecondary}
          />

          <SecondaryButton
            title="Visit our website"
            onPress={() => Linking.openURL('https://psong-sys.github.io/boothbrain-website/')}
            backgroundColor="transparent"
            borderColor={theme.colors.border}
            textColor={theme.colors.textPrimary}
            style={{ marginBottom: 12 }}
          />

          <SecondaryButton
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://psong-sys.github.io/boothbrain-website/privacy.html')}
            backgroundColor="transparent"
            borderColor={theme.colors.border}
            textColor={theme.colors.textPrimary}
            style={{ marginBottom: 12 }}
          />

          <SecondaryButton
            title="Terms of Service"
            onPress={() => Linking.openURL('https://psong-sys.github.io/boothbrain-website/terms.html')}
            backgroundColor="transparent"
            borderColor={theme.colors.border}
            textColor={theme.colors.textPrimary}
          />
        </View>

        {/* Developer Tools */}
        {(__DEV__ || Constants.expoConfig?.extra?.enableDevTools === 'true') && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.warning }] }>
            <SectionHeading
              title="Developer Tools"
              subtitle="Testing tools for development and preview builds"
              titleColor={theme.colors.warning}
              subtitleColor={theme.colors.textSecondary}
            />

            <SecondaryButton
              title="Test Crashlytics"
              onPress={handleTestCrash}
              backgroundColor="transparent"
              borderColor={theme.colors.warning}
              textColor={theme.colors.warning}
            />
          </View>
        )}

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

      {/* Subscription Modal (iOS only) */}
      {isProSubscriptionAvailable() && (
        <SubscriptionModal
          visible={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={() => {
            // Don't call refreshSession() here - it causes race conditions
            // The subscription is already synced in the modal and RevenueCat listener
            // will automatically refresh user data via onAuthStateChange
            setFeedback({ type: 'success', message: 'Successfully subscribed to Pro!' });
          }}
          userId={user?.id || ''}
          theme={theme}
        />
      )}
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
    gap: 24,
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
    marginTop: 12,
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
  comingSoonCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonMessage: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  comingSoonEta: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  freeLimitNotice: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  subscriptionHeadingGroup: {
    flex: 1,
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
