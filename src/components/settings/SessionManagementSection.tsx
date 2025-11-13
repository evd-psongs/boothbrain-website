import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { PrimaryButton, SecondaryButton, InputField, SectionHeading } from '@/components/common';
import type { ActiveSession } from '@/providers/SessionProvider';

const MIN_SESSION_PASSPHRASE_LENGTH = 8;
const SESSION_CODE_GROUP_SIZE = 4;

function stripJoinCodeFormatting(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

interface SessionManagementSectionProps {
  // Theme
  theme: any;

  // Current session state
  currentSession: ActiveSession | null;
  sessionLoading: boolean;
  sessionError: string | null;

  // Session creation state
  sessionPassphrase: string;
  setSessionPassphrase: (value: string) => void;
  creatingSession: boolean;
  handleCreateSession: () => void;

  // Session joining state
  showJoinForm: boolean;
  setShowJoinForm: (value: boolean) => void;
  joinCode: string;
  setJoinCode: (value: string) => void;
  joinPassphrase: string;
  setJoinPassphrase: (value: string) => void;
  joinCodeReady: boolean;
  joiningSession: boolean;
  handleJoinSession: () => void;
  handleJoinCodeChange: (value: string) => void;

  // Session management
  clearingSession: boolean;
  handleClearSession: () => void;
  handleShareSession: () => void;
  clearError: () => void;

  // Host-only features
  securityOverview?: {
    pendingRequests: number;
    recentFailedAttempts: number;
    recentRateLimited: number;
    lastFailedAttempt?: string;
  };
  loadingSecurityOverview: boolean;
  loadSecurityOverview: () => void;

  // Pending requests
  pendingRequests: Array<{
    id: string;
    participantName: string;
    participantEmail?: string;
    requestedAt: string;
    deviceId?: string;
  }>;
  loadingPendingRequests: boolean;
  loadPendingRequests: () => void;
  resolvingRequest?: { id: string; mode: 'approve' | 'deny' };
  handleResolveRequest: (id: string, mode: 'approve' | 'deny') => void;
}

function formatSessionCode(code: string): string {
  const normalized = stripJoinCodeFormatting(code);
  if (!normalized) return '';
  const matcher = normalized.match(new RegExp(`.{1,${SESSION_CODE_GROUP_SIZE}}`, 'g'));
  return matcher ? matcher.join('-') : normalized;
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function SessionManagementSection({
  theme,
  currentSession,
  sessionLoading,
  sessionError,
  sessionPassphrase,
  setSessionPassphrase,
  creatingSession,
  handleCreateSession,
  showJoinForm,
  setShowJoinForm,
  joinCode,
  setJoinCode,
  joinPassphrase,
  setJoinPassphrase,
  joinCodeReady,
  joiningSession,
  handleJoinSession,
  handleJoinCodeChange,
  clearingSession,
  handleClearSession,
  handleShareSession,
  clearError,
  securityOverview,
  loadingSecurityOverview,
  loadSecurityOverview,
  pendingRequests,
  loadingPendingRequests,
  loadPendingRequests,
  resolvingRequest,
  handleResolveRequest,
}: SessionManagementSectionProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
              ? 'You are hosting this session. Share the code (and passphrase if set) privately, then approve requests below.'
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

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Passphrase required</Text>
            <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>
              {currentSession.requiresPassphrase ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Host approval</Text>
            <Text style={[styles.metaValue, { color: theme.colors.textPrimary }]}>
              {currentSession.approvalRequired ? 'Required' : 'Automatic'}
            </Text>
          </View>

          {currentSession.isHost ? (
            <>
              <View style={[styles.securityCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                <View style={styles.securityHeader}>
                  <Text style={[styles.securityTitle, { color: theme.colors.textPrimary }]}>Security overview</Text>
                  <Pressable
                    onPress={loadSecurityOverview}
                    disabled={loadingSecurityOverview}
                    style={styles.securityRefresh}
                  >
                    {loadingSecurityOverview ? (
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    ) : (
                      <Text style={[styles.securityRefreshText, { color: theme.colors.primary }]}>Refresh</Text>
                    )}
                  </Pressable>
                </View>
                <Text style={[styles.securityBody, { color: theme.colors.textSecondary }]}>
                  Pending requests:{' '}
                  <Text style={[styles.securityValue, { color: theme.colors.textPrimary }]}>
                    {securityOverview?.pendingRequests ?? pendingRequests.length}
                  </Text>
                </Text>
                <Text style={[styles.securityBody, { color: theme.colors.textSecondary }]}>
                  Failed attempts (10 min):{' '}
                  <Text style={[styles.securityValue, { color: theme.colors.textPrimary }]}>
                    {securityOverview?.recentFailedAttempts ?? 0}
                  </Text>
                </Text>
                <Text style={[styles.securityBody, { color: theme.colors.textSecondary }]}>
                  Throttled attempts (10 min):{' '}
                  <Text style={[styles.securityValue, { color: theme.colors.textPrimary }]}>
                    {securityOverview?.recentRateLimited ?? 0}
                  </Text>
                </Text>
                {securityOverview?.lastFailedAttempt ? (
                  <Text style={[styles.securityBodyMuted, { color: theme.colors.textSecondary }]}>
                    Last failed attempt {formatRelativeTime(securityOverview.lastFailedAttempt)}.
                  </Text>
                ) : null}
                {(securityOverview?.recentFailedAttempts ?? 0) >= 5 ? (
                  <Text style={[styles.securityWarning, { color: theme.colors.error }]}>
                    Multiple failures detected. Rotate the session or end it if this wasn't you.
                  </Text>
                ) : null}
              </View>

              <View style={[styles.pendingCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                <View style={styles.pendingHeader}>
                  <Text style={[styles.pendingTitle, { color: theme.colors.textPrimary }]}>Pending join requests</Text>
                  <Pressable
                    onPress={loadPendingRequests}
                    disabled={loadingPendingRequests}
                    style={styles.securityRefresh}
                  >
                    {loadingPendingRequests ? (
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    ) : (
                      <Text style={[styles.securityRefreshText, { color: theme.colors.primary }]}>Refresh</Text>
                    )}
                  </Pressable>
                </View>
                {pendingRequests.length === 0 ? (
                  <Text style={[styles.pendingEmptyText, { color: theme.colors.textSecondary }]}>
                    No pending requests right now.
                  </Text>
                ) : (
                  pendingRequests.map((request) => {
                    const isResolving = resolvingRequest?.id === request.id;
                    const isApproving = isResolving && resolvingRequest?.mode === 'approve';
                    const isDenying = isResolving && resolvingRequest?.mode === 'deny';
                    return (
                      <View
                        key={request.id}
                        style={[styles.pendingRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                      >
                        <View style={styles.pendingInfo}>
                          <Text style={[styles.pendingName, { color: theme.colors.textPrimary }]}>
                            {request.participantName}
                          </Text>
                          <Text style={[styles.pendingEmail, { color: theme.colors.textSecondary }]}>
                            {request.participantEmail || 'No email on file'}
                          </Text>
                          <Text style={[styles.pendingMeta, { color: theme.colors.textSecondary }]}>
                            Requested {formatRelativeTime(request.requestedAt)}
                            {request.deviceId ? ` • ${request.deviceId}` : ''}
                          </Text>
                        </View>
                        <View style={styles.pendingActions}>
                          <Pressable
                            disabled={Boolean(resolvingRequest)}
                            onPress={() => handleResolveRequest(request.id, 'deny')}
                            style={({ pressed }) => [
                              styles.pendingActionButton,
                              styles.pendingDenyButton,
                              {
                                borderColor: theme.colors.error,
                                opacity: pressed && !resolvingRequest ? 0.85 : 1,
                              },
                            ]}
                          >
                            {isDenying ? (
                              <ActivityIndicator size="small" color={theme.colors.error} />
                            ) : (
                              <Text style={[styles.pendingActionText, { color: theme.colors.error }]}>Deny</Text>
                            )}
                          </Pressable>
                          <Pressable
                            disabled={Boolean(resolvingRequest)}
                            onPress={() => handleResolveRequest(request.id, 'approve')}
                            style={({ pressed }) => [
                              styles.pendingActionButton,
                              styles.pendingApproveButton,
                              {
                                backgroundColor: theme.colors.primary,
                                opacity: pressed && !resolvingRequest ? 0.9 : 1,
                              },
                            ]}
                          >
                            {isApproving ? (
                              <ActivityIndicator size="small" color={theme.colors.surface} />
                            ) : (
                              <Text style={[styles.pendingActionText, { color: theme.colors.surface }]}>Approve</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={styles.buttonSpacing}>
                <SecondaryButton
                  title="Share code"
                  onPress={handleShareSession}
                  backgroundColor="transparent"
                  borderColor={theme.colors.primary}
                  textColor={theme.colors.primary}
                />
              </View>
            </>
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
            Create a session to broadcast inventory updates, or join one that's already in progress.
          </Text>

          <InputField
            label="Optional passphrase"
            value={sessionPassphrase}
            onChange={setSessionPassphrase}
            placeholder="Share privately with teammates"
            placeholderColor={theme.colors.textMuted}
            borderColor={theme.colors.border}
            backgroundColor={theme.colors.surface}
            textColor={theme.colors.textPrimary}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={[styles.sessionSubHint, { color: theme.colors.textSecondary }]}>
            Hosts must approve join requests. Passphrases need at least {MIN_SESSION_PASSPHRASE_LENGTH} characters.
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
                placeholder="ABCD-EFGH-IJKL"
                placeholderColor={theme.colors.textMuted}
                borderColor={theme.colors.border}
                backgroundColor={theme.colors.surface}
                textColor={theme.colors.textPrimary}
                autoCapitalize="characters"
              />

              <InputField
                label="Passphrase"
                value={joinPassphrase}
                onChange={setJoinPassphrase}
                placeholder="Enter passphrase (if required)"
                placeholderColor={theme.colors.textMuted}
                borderColor={theme.colors.border}
                backgroundColor={theme.colors.surface}
                textColor={theme.colors.textPrimary}
                secureTextEntry
                autoCapitalize="none"
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
                  setJoinPassphrase('');
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
                setJoinPassphrase('');
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
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  sessionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  sessionSubHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
  },
  sessionCode: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  securityCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  securityRefresh: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  securityRefreshText: {
    fontSize: 14,
    fontWeight: '500',
  },
  securityBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  securityBodyMuted: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  securityValue: {
    fontWeight: '600',
  },
  securityWarning: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '500',
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  pendingEmptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  pendingRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pendingInfo: {
    flex: 1,
    gap: 4,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: '600',
  },
  pendingEmail: {
    fontSize: 14,
  },
  pendingMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pendingActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDenyButton: {
    borderWidth: 1,
  },
  pendingApproveButton: {},
  pendingActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSpacing: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});