import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@/providers/ThemeProvider';

interface TaskModalProps {
  visible: boolean;
  taskTitle: string;
  taskPhase: 'prep' | 'live' | 'post';
  onChangeTitle: (value: string) => void;
  onChangePhase: (value: 'prep' | 'live' | 'post') => void;
  onSave: () => void;
  onClose: () => void;
  theme: Theme;
}

export function TaskModal({
  visible,
  taskTitle,
  taskPhase,
  onChangeTitle,
  onChangePhase,
  onSave,
  onClose,
  theme,
}: TaskModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Add event task</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
            >
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.modalField}>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Task</Text>
            <TextInput
              value={taskTitle}
              onChangeText={onChangeTitle}
              placeholder="Bring extra tablecloth"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Phase</Text>
            <View style={styles.phaseToggleRow}>
              {(['prep', 'live', 'post'] as const).map((option) => {
                const active = taskPhase === option;
                const label = option === 'prep' ? 'Prep' : option === 'live' ? 'Live' : 'Wrap-up';
                return (
                  <Pressable
                    key={option}
                    onPress={() => onChangePhase(option)}
                    style={({ pressed }) => [
                      styles.phaseToggleChip,
                      {
                        backgroundColor: active ? theme.colors.primary : 'transparent',
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? theme.colors.surface : theme.colors.textPrimary,
                        fontWeight: active ? '600' : '500',
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={onSave}
            style={({ pressed }) => [
              styles.modalPrimary,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.modalPrimaryText, { color: theme.colors.surface }]}>Save task</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalField: {
    gap: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  phaseToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phaseToggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalPrimary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
});