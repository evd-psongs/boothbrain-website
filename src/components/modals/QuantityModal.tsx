import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Theme } from '@/providers/ThemeProvider';
import type { InventoryItem } from '@/types/inventory';

interface QuantityModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quantityInput: string;
  onChangeQuantity: (value: string) => void;
  themeColors: Theme['colors'];
  item: InventoryItem | null;
}

export function QuantityModal({
  visible,
  onClose,
  onConfirm,
  quantityInput,
  onChangeQuantity,
  themeColors,
  item,
}: QuantityModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.quantityCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
            {item ? `Adjust ${item.name}` : 'Adjust quantity'}
          </Text>
          <TextInput
            value={quantityInput}
            onChangeText={onChangeQuantity}
            keyboardType="number-pad"
            placeholder="Quantity"
            placeholderTextColor={themeColors.textMuted}
            style={[
              styles.textInput,
              { borderColor: themeColors.border, color: themeColors.textPrimary },
            ]}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: themeColors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.textPrimary }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: themeColors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: themeColors.surface }]}>
                Save
              </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  quantityCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});