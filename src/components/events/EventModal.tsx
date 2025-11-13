import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '@/providers/ThemeProvider';
import { formatDateLabel } from '@/utils/dates';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface EventModalProps {
  visible: boolean;
  isEditing: boolean;
  eventName: string;
  eventStartDate: Date | null;
  eventEndDate: Date | null;
  eventLocation: string;
  eventNotes: string;
  onChangeName: (value: string) => void;
  onChangeStartDate: (value: Date | null) => void;
  onChangeEndDate: (value: Date | null) => void;
  onChangeLocation: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  theme: Theme;
  isSaving?: boolean;
}

export function EventModal({
  visible,
  isEditing,
  eventName,
  eventStartDate,
  eventEndDate,
  eventLocation,
  eventNotes,
  onChangeName,
  onChangeStartDate,
  onChangeEndDate,
  onChangeLocation,
  onChangeNotes,
  onSave,
  onClose,
  theme,
  isSaving = false,
}: EventModalProps) {
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | null>(null);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const openDatePicker = useCallback((type: 'start' | 'end') => {
    setDatePickerType(type);
    const targetDate = type === 'start' ? eventStartDate : eventEndDate;
    if (targetDate) {
      setPickerYear(targetDate.getFullYear());
      setPickerMonth(targetDate.getMonth());
    } else {
      setPickerYear(new Date().getFullYear());
      setPickerMonth(new Date().getMonth());
    }
    setDatePickerVisible(true);
  }, [eventStartDate, eventEndDate]);

  const handleSelectMonth = useCallback((month: number) => {
    setPickerMonth(month);
  }, []);

  const handleSelectYear = useCallback((delta: number) => {
    setPickerYear((prev) => prev + delta);
  }, []);

  const handleSelectDate = useCallback((day: number) => {
    const selectedDate = new Date(pickerYear, pickerMonth, day);
    if (datePickerType === 'start') {
      onChangeStartDate(selectedDate);
      if (!eventEndDate || selectedDate > eventEndDate) {
        onChangeEndDate(selectedDate);
      }
    } else if (datePickerType === 'end') {
      if (!eventStartDate || selectedDate >= eventStartDate) {
        onChangeEndDate(selectedDate);
      }
    }
    setDatePickerVisible(false);
    setDatePickerType(null);
  }, [pickerYear, pickerMonth, datePickerType, onChangeStartDate, onChangeEndDate, eventStartDate, eventEndDate]);

  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const selectedDayForPicker = (() => {
    const targetDate = datePickerType === 'start' ? eventStartDate : eventEndDate;
    if (!targetDate) return null;
    if (targetDate.getFullYear() !== pickerYear || targetDate.getMonth() !== pickerMonth) return null;
    return targetDate.getDate();
  })();

  const handleCloseModal = useCallback(() => {
    if (datePickerVisible) {
      setDatePickerVisible(false);
      setDatePickerType(null);
      return;
    }
    onClose();
  }, [datePickerVisible, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseModal}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboardAvoid}>
        <View style={styles.modalOverlay}>
          <View style={[styles.fullModalCard, { backgroundColor: theme.colors.background }]}>
            <SafeAreaView edges={['top']} style={[styles.fullModalSafeArea, { backgroundColor: theme.colors.background }]}>
              <View style={[styles.fullModalHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                  {isEditing ? 'Edit event' : 'Add event'}
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 20,
                    backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : 'transparent',
                  })}
                >
                  <Feather name="x" size={24} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            </SafeAreaView>
            <ScrollView
              style={styles.fullModalContent}
              contentContainerStyle={styles.fullModalContentContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalField}>
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Name</Text>
                <TextInput
                  value={eventName}
                  onChangeText={onChangeName}
                  placeholder="GemCon 2025"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Start date</Text>
                <Pressable
                  onPress={() => openDatePicker('start')}
                  style={({ pressed }) => [
                    styles.modalInput,
                    styles.dateInput,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: pressed ? 'rgba(0,0,0,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: eventStartDate ? theme.colors.textPrimary : theme.colors.textMuted }}>
                    {formatDateLabel(eventStartDate)}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.modalField}>
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>End date</Text>
                <Pressable
                  onPress={() => openDatePicker('end')}
                  style={({ pressed }) => [
                    styles.modalInput,
                    styles.dateInput,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: pressed ? 'rgba(0,0,0,0.04)' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: eventEndDate ? theme.colors.textPrimary : theme.colors.textMuted }}>
                    {formatDateLabel(eventEndDate ?? eventStartDate)}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.modalField}>
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Location (optional)</Text>
                <TextInput
                  value={eventLocation}
                  onChangeText={onChangeLocation}
                  placeholder="Austin Convention Center"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                  returnKeyType="done"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Notes (optional)</Text>
                <TextInput
                  value={eventNotes}
                  onChangeText={onChangeNotes}
                  placeholder="Need extra signage"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.modalInput,
                    styles.multilineInput,
                    { borderColor: theme.colors.border, color: theme.colors.textPrimary }
                  ]}
                />
              </View>
              <Pressable
                onPress={onSave}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.modalPrimary,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: isSaving ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalPrimaryText, { color: theme.colors.surface }]}>
                  {isEditing ? 'Save changes' : 'Create event'}
                </Text>
              </Pressable>
            </ScrollView>

            {datePickerVisible ? (
              <View style={[styles.datePickerOverlay, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.datePickerCard, { borderColor: theme.colors.border }]}>
                  <View style={styles.yearSelector}>
                    <Pressable onPress={() => handleSelectYear(-1)} hitSlop={12}>
                      <Feather name="chevron-left" size={20} color={theme.colors.textPrimary} />
                    </Pressable>
                    <Text style={[styles.yearLabel, { color: theme.colors.textPrimary }]}>{pickerYear}</Text>
                    <Pressable onPress={() => handleSelectYear(1)} hitSlop={12}>
                      <Feather name="chevron-right" size={20} color={theme.colors.textPrimary} />
                    </Pressable>
                  </View>
                  <View style={styles.monthSelectorRow}>
                    {MONTH_LABELS.map((label, index) => {
                      const active = pickerMonth === index;
                      return (
                        <Pressable
                          key={label}
                          onPress={() => handleSelectMonth(index)}
                          style={({ pressed }) => [
                            styles.monthChip,
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
                  <View style={styles.dayGrid}>
                    {Array.from({ length: daysInMonth }, (_, index) => {
                      const day = index + 1;
                      const active = selectedDayForPicker === day;
                      return (
                        <Pressable
                          key={day}
                          onPress={() => handleSelectDate(day)}
                          style={({ pressed }) => [
                            styles.dayButton,
                            {
                              backgroundColor: active ? theme.colors.primary : 'transparent',
                              borderColor: active ? theme.colors.primary : theme.colors.border,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? theme.colors.surface : theme.colors.textPrimary,
                              fontWeight: active ? '600' : '500',
                            }}
                          >
                            {day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={() => {
                      setDatePickerVisible(false);
                      setDatePickerType(null);
                    }}
                    style={({ pressed }) => [
                      styles.datePickerCancel,
                      {
                        opacity: pressed ? 0.8 : 1,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalKeyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
  },
  fullModalCard: {
    flex: 1,
  },
  fullModalSafeArea: {
    backgroundColor: 'transparent',
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  fullModalContent: {
    flex: 1,
  },
  fullModalContentContainer: {
    padding: 20,
    gap: 16,
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
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateInput: {
    justifyContent: 'center',
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
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yearLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 45,
    alignItems: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerCancel: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
});