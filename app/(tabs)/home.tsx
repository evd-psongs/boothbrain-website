import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { useOrderReports } from '@/hooks/useOrderReports';
import {
  useUpcomingEvents,
  type EventChecklistItem,
  type UpcomingEvent,
} from '@/hooks/useUpcomingEvents';
import { useInventory } from '@/hooks/useInventory';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateLabel = (date: Date | null) => {
  if (!date) return 'Select date';
  try {
    return date.toLocaleDateString();
  } catch {
    return 'Select date';
  }
};

const formatEventRange = (startISO: string, endISO: string) => {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime())) return endISO;
    if (Number.isNaN(end.getTime())) return start.toLocaleDateString();
    const startLabel = start.toLocaleDateString();
    const endLabel = end.toLocaleDateString();
    return startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`;
  } catch {
    return startISO;
  }
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession } = useSession();

  const userId = user?.id ?? null;

  const { orders, loading: loadingOrders, refresh: refreshOrders } = useOrderReports(
    userId,
    currentSession?.eventId ?? null,
  );
  const { items, loading: loadingInventory, refresh: refreshInventory } = useInventory(userId);
  const {
    events,
    loading: loadingEvents,
    addEvent,
    updateEvent,
    removeEvent,
    refresh: refreshEvents,
  } = useUpcomingEvents(userId);

  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventStartDate, setEventStartDate] = useState<Date | null>(null);
  const [eventEndDate, setEventEndDate] = useState<Date | null>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'start' | 'end' | null>(null);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const lowStockItems = useMemo(
    () =>
      items.filter((item) => {
        const threshold = Math.max(item.lowStockThreshold, 0);
        return item.quantity <= threshold;
      }),
    [items],
  );

  const suggestions = useMemo(() => {
    const list: { title: string; body: string; icon: keyof typeof Feather.glyphMap }[] = [];
    if (!events.length) {
      list.push({
        title: 'Plan your next booth',
        body: 'Add an upcoming event so BoothBrain can help you prep inventory and promos.',
        icon: 'calendar',
      });
    }
    if (lowStockItems.length) {
      list.push({
        title: 'Restock low inventory',
        body: `${lowStockItems.length} item${lowStockItems.length === 1 ? '' : 's'} close to selling out.`,
        icon: 'alert-triangle',
      });
    }
    if (!orders.length) {
      list.push({
        title: 'Record your first sale',
        body: 'Start a sale to unlock live revenue tracking and reporting tools.',
        icon: 'trending-up',
      });
    }
    return list;
  }, [events.length, lowStockItems.length, orders.length]);

  const handleRefresh = useCallback(() => {
    void refreshOrders();
    void refreshInventory();
    void refreshEvents();
  }, [refreshEvents, refreshInventory, refreshOrders]);

  const openDatePicker = useCallback(
    (type: 'start' | 'end') => {
      const baseDate =
        type === 'start'
          ? eventStartDate ?? new Date()
          : eventEndDate ?? eventStartDate ?? new Date();
      setPickerYear(baseDate.getFullYear());
      setPickerMonth(baseDate.getMonth());
      setDatePickerType(type);
      setDatePickerVisible(true);
    },
    [eventEndDate, eventStartDate],
  );

  const handleSelectDate = useCallback(
    (day: number) => {
      const selected = new Date(pickerYear, pickerMonth, day);
      if (Number.isNaN(selected.getTime())) {
        setDatePickerVisible(false);
        return;
      }
      if (datePickerType === 'start') {
        setEventStartDate(selected);
        if (!eventEndDate || selected.getTime() > eventEndDate.getTime()) {
          setEventEndDate(selected);
        }
      } else if (datePickerType === 'end') {
        setEventEndDate(selected);
      }
      setDatePickerVisible(false);
      setDatePickerType(null);
    },
    [datePickerType, eventEndDate, pickerMonth, pickerYear],
  );

  const handleAdjustYear = useCallback((delta: number) => {
    setPickerYear((prev) => prev + delta);
  }, []);

  const handleSelectMonth = useCallback((monthIndex: number) => {
    setPickerMonth(monthIndex);
  }, []);

  const handleOpenEventModal = useCallback(() => {
    setEventName('');
    setEventStartDate(null);
    setEventEndDate(null);
    setEventLocation('');
    setEventNotes('');
    setDatePickerVisible(false);
    setDatePickerType(null);
    const today = new Date();
    setPickerYear(today.getFullYear());
    setPickerMonth(today.getMonth());
    setEventModalVisible(true);
  }, []);

  const defaultChecklist: EventChecklistItem[] = useMemo(
    () => [
      { id: 'inventory', title: 'Confirm inventory counts', done: false },
      { id: 'payments', title: 'Verify payment links & QR codes', done: false },
      { id: 'marketing', title: 'Schedule social promo', done: false },
    ],
    [],
  );

  const daysInMonth = useMemo(() => {
    return new Date(pickerYear, pickerMonth + 1, 0).getDate();
  }, [pickerMonth, pickerYear]);

  const selectedDayForPicker = useMemo(() => {
    const activeDate = datePickerType === 'start' ? eventStartDate : eventEndDate;
    if (!activeDate) return null;
    if (activeDate.getFullYear() !== pickerYear || activeDate.getMonth() !== pickerMonth) return null;
    return activeDate.getDate();
  }, [datePickerType, eventEndDate, eventStartDate, pickerMonth, pickerYear]);

  const handleSaveEvent = useCallback(() => {
    if (!eventName.trim()) {
      Alert.alert('Add event', 'Give your event a name.');
      return;
    }
    if (!eventStartDate) {
      Alert.alert('Add event', 'Pick a start date for this event.');
      return;
    }

    const endDateValue = eventEndDate ?? eventStartDate;
    if (endDateValue.getTime() < eventStartDate.getTime()) {
      Alert.alert('Add event', 'End date can’t be earlier than the start date.');
      return;
    }

    const timestamp = Date.now();

    const newEvent: UpcomingEvent = {
      id: `evt-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      name: eventName.trim(),
      startDateISO: eventStartDate.toISOString(),
      endDateISO: endDateValue.toISOString(),
      location: eventLocation.trim() ? eventLocation.trim() : null,
      notes: eventNotes.trim() ? eventNotes.trim() : null,
      checklist: defaultChecklist.map((item, index) => ({
        ...item,
        id: `${item.id}-${timestamp}-${index}`,
      })),
    };

    void addEvent(newEvent);
    setEventModalVisible(false);
  }, [addEvent, defaultChecklist, eventEndDate, eventLocation, eventName, eventNotes, eventStartDate]);

  const handleRemoveEvent = useCallback(
    (eventId: string) => {
      Alert.alert('Remove event', 'Remove this upcoming event?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeEvent(eventId);
          },
        },
      ]);
    },
    [removeEvent],
  );

  const combinedLoading = loadingOrders || loadingInventory || loadingEvents;

  const handleToggleChecklistItem = useCallback(
    (eventId: string, itemId: string, done: boolean) => {
      void updateEvent(eventId, (event) => ({
        ...event,
        checklist: event.checklist?.map((entry) =>
          entry.id === itemId ? { ...entry, done } : entry,
        ),
      }));
    },
    [updateEvent],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={combinedLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Welcome back</Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Here’s what’s on deck.</Text>
            </View>
            <Feather name="home" size={22} color={theme.colors.primary} />
          </View>

          <View
            style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Upcoming events</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                  Keep upcoming booths and pop-ups on your radar.
                </Text>
              </View>
              <Pressable
                onPress={handleOpenEventModal}
                style={({ pressed }) => [
                  styles.addButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={16} color={theme.colors.surface} />
              </Pressable>
            </View>

            {events.length ? (
              <View style={{ gap: 12 }}>
                {events.map((event) => {
                  const formattedRange = formatEventRange(event.startDateISO, event.endDateISO);
                  return (
                    <View
                      key={event.id}
                      style={[styles.eventCard, { borderColor: theme.colors.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.eventName, { color: theme.colors.textPrimary }]}>{event.name}</Text>
                        <Text style={{ color: theme.colors.textSecondary }}>{formattedRange}</Text>
                        {event.location ? (
                          <Text style={{ color: theme.colors.textSecondary }}>{event.location}</Text>
                        ) : null}
                        {event.notes ? (
                          <Text style={[styles.eventNotes, { color: theme.colors.textMuted }]}>{event.notes}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => handleRemoveEvent(event.id)} hitSlop={10}>
                        <Feather name="trash-2" size={16} color={theme.colors.error} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyEventState}>
                <Feather name="calendar" size={20} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={{ color: theme.colors.textSecondary }}>No events planned yet.</Text>
              </View>
            )}
          </View>

          <View
            style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>Quick wins</Text>
            {suggestions.length ? (
              <View style={{ gap: 12 }}>
                {suggestions.map((tip) => (
                  <View key={tip.title} style={styles.tipRow}>
                    <Feather name={tip.icon} size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tipTitle, { color: theme.colors.textPrimary }]}>{tip.title}</Text>
                      <Text style={{ color: theme.colors.textSecondary }}>{tip.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: theme.colors.textSecondary }}>Nice! You’re all caught up.</Text>
            )}
          </View>

          {events.length ? (
            <View
              style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>Event prep</Text>
              {events.map((event) => (
                <View key={`${event.id}-prep`} style={styles.prepCard}>
                  <View style={styles.prepHeader}>
                    <Text style={[styles.prepTitle, { color: theme.colors.textPrimary }]}>{event.name}</Text>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {formatEventRange(event.startDateISO, event.endDateISO)}
                    </Text>
                  </View>
                  {event.checklist?.length ? (
                    <View style={{ gap: 8 }}>
                      {event.checklist.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => handleToggleChecklistItem(event.id, item.id, !item.done)}
                          style={({ pressed }) => [
                            styles.checklistRow,
                            {
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: item.done ? theme.colors.primary : theme.colors.border,
                                backgroundColor: item.done ? theme.colors.primary : 'transparent',
                              },
                            ]}
                          >
                            {item.done ? <Feather name="check" size={12} color={theme.colors.surface} /> : null}
                          </View>
                          <Text
                            style={{
                              color: item.done ? theme.colors.textMuted : theme.colors.textPrimary,
                              textDecorationLine: item.done ? 'line-through' : 'none',
                            }}
                          >
                            {item.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: theme.colors.textSecondary }}>No prep tasks yet.</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={eventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEventModalVisible(false);
          setDatePickerVisible(false);
          setDatePickerType(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Add event</Text>
              <Pressable
                onPress={() => {
                  setEventModalVisible(false);
                  setDatePickerVisible(false);
                  setDatePickerType(null);
                }}
                hitSlop={12}
              >
                <Feather name="x" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.modalField}>
              <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Name</Text>
              <TextInput
                value={eventName}
                onChangeText={setEventName}
                placeholder="GemCon 2025"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
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
                onChangeText={setEventLocation}
                placeholder="Austin Convention Center"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Notes (optional)</Text>
              <TextInput
                value={eventNotes}
                onChangeText={setEventNotes}
                placeholder="Need extra signage"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.modalInput,
                  styles.notesInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                  },
                ]}
                multiline
              />
            </View>

            <Pressable
              onPress={handleSaveEvent}
              style={({ pressed }) => [
                styles.modalPrimary,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.modalPrimaryText, { color: theme.colors.surface }]}>Save event</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDatePickerVisible(false);
          setDatePickerType(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.datePickerHeader}>
              <Pressable onPress={() => handleAdjustYear(-1)} hitSlop={10}>
                <Feather name="chevron-left" size={18} color={theme.colors.textPrimary} />
              </Pressable>
              <Text style={[styles.datePickerYear, { color: theme.colors.textPrimary }]}>{pickerYear}</Text>
              <Pressable onPress={() => handleAdjustYear(1)} hitSlop={10}>
                <Feather name="chevron-right" size={18} color={theme.colors.textPrimary} />
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
      </Modal>

      {combinedLoading && !orders.length && !items.length ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 110,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  prepCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  prepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prepTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventNotes: {
    marginTop: 6,
    fontSize: 13,
  },
  emptyEventState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerCard: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    width: '100%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerYear: {
    fontSize: 18,
    fontWeight: '700',
  },
  monthSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerCancel: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalField: {
    gap: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dateInput: {
    justifyContent: 'center',
    minHeight: 44,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalPrimary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 10, 15, 0.08)',
  },
});
