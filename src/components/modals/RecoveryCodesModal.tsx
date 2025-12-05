import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '@/components/common';
import type { Theme } from '@/providers/ThemeProvider';

type RecoveryCodesModalProps = {
  visible: boolean;
  codes: string[];
  onClose: () => void;
  onConfirm: () => void;
  theme: Theme;
};

export function RecoveryCodesModal({
  visible,
  codes,
  onClose,
  onConfirm,
  theme,
}: RecoveryCodesModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Create text file content
      const content = `BoothBrain 2FA Recovery Codes
Generated: ${new Date().toLocaleString()}

IMPORTANT: Save these codes in a secure location!
Each code can only be used once.

Recovery Codes:
${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

If you lose access to your authenticator app, you can use these codes to log in and re-enable 2FA.

Never share these codes with anyone.
`;

      // Use native Share to share/save the codes
      await Share.share({
        message: content,
        title: 'BoothBrain Recovery Codes',
      });

      setConfirmed(true);
    } catch (error) {
      console.error('Failed to share recovery codes:', error);
      if ((error as Error).message !== 'User did not share') {
        Alert.alert('Share Failed', 'Failed to share recovery codes. Please try copying instead.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      const codesText = codes.join('\n');
      Clipboard.setString(codesText);

      Alert.alert('Copied!', 'Recovery codes copied to clipboard.');
      setConfirmed(true);
    } catch (error) {
      console.error('Failed to copy codes:', error);
      Alert.alert('Copy Failed', 'Failed to copy codes. Please try manually.');
    }
  };

  const handleConfirm = () => {
    if (!confirmed) {
      Alert.alert(
        'Save Your Codes First',
        'Please download or copy your recovery codes before continuing. You will not be able to see them again.',
        [{ text: 'OK' }]
      );
      return;
    }

    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (confirmed) {
          onClose();
        } else {
          Alert.alert(
            'Are You Sure?',
            'If you close this without saving your recovery codes, you will not be able to see them again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Close Anyway', style: 'destructive', onPress: onClose },
            ]
          );
        }
      }}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Ionicons name="shield-checkmark" size={32} color={theme.colors.warning} />
              </View>
              {confirmed && (
                <Pressable onPress={onClose}>
                  <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
                </Pressable>
              )}
            </View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Save Your Recovery Codes
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              You won't be able to see these codes again after closing this screen.
            </Text>
          </View>

          {/* Warning Banner */}
          <View style={[styles.warningBanner, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.warning }]}>
            <Ionicons name="warning" size={24} color={theme.colors.warning} />
            <View style={styles.warningTextContainer}>
              <Text style={[styles.warningTitle, { color: theme.colors.warning }]}>
                Important!
              </Text>
              <Text style={[styles.warningText, { color: theme.colors.textSecondary }]}>
                Save these codes in a secure location. Each code can only be used once to bypass 2FA if you lose access to your authenticator app.
              </Text>
            </View>
          </View>

          {/* Recovery Codes List */}
          <View style={[styles.codesContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.codesHeader, { color: theme.colors.textPrimary }]}>
              Your Recovery Codes ({codes.length})
            </Text>
            <View style={styles.codesList}>
              {codes.map((code, index) => (
                <View
                  key={index}
                  style={[styles.codeItem, { backgroundColor: theme.colors.surfaceMuted }]}
                >
                  <Text style={[styles.codeNumber, { color: theme.colors.textMuted }]}>
                    {index + 1}.
                  </Text>
                  <Text style={[styles.codeText, { color: theme.colors.textPrimary }]} selectable>
                    {code}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <SecondaryButton
              title={downloading ? 'Downloading...' : 'Download as File'}
              onPress={handleDownload}
              disabled={downloading}
              loading={downloading}
              backgroundColor={theme.colors.surface}
              textColor={theme.colors.textPrimary}
              borderColor={theme.colors.border}
            />
            <SecondaryButton
              title="Copy to Clipboard"
              onPress={handleCopy}
              backgroundColor={theme.colors.surface}
              textColor={theme.colors.textPrimary}
              borderColor={theme.colors.border}
            />
          </View>

          {/* Confirmation Checkbox */}
          <Pressable
            onPress={() => setConfirmed(!confirmed)}
            style={[styles.checkbox, { borderColor: theme.colors.border }]}
          >
            <View
              style={[
                styles.checkboxBox,
                {
                  backgroundColor: confirmed ? theme.colors.primary : 'transparent',
                  borderColor: confirmed ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              {confirmed && <Ionicons name="checkmark" size={18} color={theme.colors.surface} />}
            </View>
            <Text style={[styles.checkboxLabel, { color: theme.colors.textPrimary }]}>
              I have saved my recovery codes in a secure location
            </Text>
          </Pressable>

          {/* Continue Button */}
          <PrimaryButton
            title="Continue"
            onPress={handleConfirm}
            disabled={!confirmed}
            backgroundColor={confirmed ? theme.colors.primary : theme.colors.border}
            textColor={theme.colors.surface}
          />

          {/* Help Text */}
          <View style={[styles.helpBox, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
              Store these codes in a password manager, secure note app, or print them and keep them in a safe place.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    gap: 24,
  },
  header: {
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningTextContainer: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  codesContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  codesHeader: {
    fontSize: 16,
    fontWeight: '600',
  },
  codesList: {
    gap: 8,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
  },
  codeNumber: {
    fontSize: 14,
    fontWeight: '600',
    width: 24,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  actions: {
    gap: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  helpBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
