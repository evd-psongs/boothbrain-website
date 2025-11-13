import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

type ImportModalProps = {
  visible: boolean;
  isProcessing: boolean;
  googleSheetUrl: string;
  importError: string | null;
  onClose: () => void;
  onImportCsv: () => void;
  onImportFromGoogleSheets: () => void;
  onGoogleSheetUrlChange: (url: string) => void;
  onClearError: () => void;
};

export function ImportModal({
  visible,
  isProcessing,
  googleSheetUrl,
  importError,
  onClose,
  onImportCsv,
  onImportFromGoogleSheets,
  onGoogleSheetUrlChange,
  onClearError,
}: ImportModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Import inventory</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]}>
            Import from a CSV file or paste a Google Sheets link that anyone with the link can view.
          </Text>

          <Pressable
            onPress={onImportCsv}
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.modalAction,
              { borderColor: theme.colors.primary, backgroundColor: pressed ? 'rgba(101, 88, 245, 0.12)' : 'transparent' },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Feather name="upload" size={16} color={theme.colors.primary} />
                <Text style={[styles.modalActionText, { color: theme.colors.primary }]}>Import CSV file</Text>
              </>
            )}
          </Pressable>

          <View style={styles.modalForm}>
            <Text style={[styles.modalFieldLabel, { color: theme.colors.textSecondary }]}>Google Sheets link</Text>
            <TextInput
              value={googleSheetUrl}
              onChangeText={(text) => {
                onGoogleSheetUrlChange(text);
                if (importError) onClearError();
              }}
              placeholder="https://docs.google.com/..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.modalTextInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
            />
            {importError ? <Text style={[styles.modalError, { color: theme.colors.error }]}>{importError}</Text> : null}
            <Pressable
              onPress={onImportFromGoogleSheets}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.modalConfirm,
                { backgroundColor: theme.colors.primary, opacity: pressed || isProcessing ? 0.8 : 1 },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Text style={[styles.modalConfirmText, { color: theme.colors.surface }]}>Import from Sheets</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalForm: {
    gap: 10,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  modalError: {
    fontSize: 12,
  },
  modalConfirm: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
  },
});