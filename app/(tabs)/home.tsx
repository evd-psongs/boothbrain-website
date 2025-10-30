import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { useOrderReports } from '@/hooks/useOrderReports';
import { useEvents } from '@/hooks/useEvents';
import type { EventChecklistItem, EventRecord } from '@/types/events';
import { useInventory } from '@/hooks/useInventory';
import { useEventStagedInventory } from '@/hooks/useEventStagedInventory';
import { deleteEventStagedInventoryForEvent, deleteEventStagedInventoryItem } from '@/lib/eventStagedInventory';
import { removeItemImage } from '@/lib/itemImages';
import { createEvent, updateEventRecord, deleteEventRecord } from '@/lib/events';
import { StagedInventoryModal } from '@/components/StagedInventoryModal';
import type { EventStagedInventoryItem } from '@/types/inventory';
import { formatCurrencyFromCents } from '@/utils/currency';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FREE_PLAN_EVENT_LIMIT = 1;

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
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { currentSession, sharedOwnerId, sharedPlanTier, sharedPlanPaused } = useSession();
  const planTier = sharedPlanTier;
  const planPaused = sharedPlanPaused;

  const userId = user?.id ?? null;
  const ownerUserId = sharedOwnerId ?? userId;

  const { orders, loading: loadingOrders, refresh: refreshOrders } = useOrderReports(
    ownerUserId,
    currentSession?.eventId ?? null,
  );
  const { items, loading: loadingInventory, refresh: refreshInventory } = useInventory(ownerUserId);
  const {
    events,
    loading: loadingEvents,
    refresh: refreshEvents,
    setEvents,
  } = useEvents(ownerUserId);
  const {
    stagedByEvent,
    loading: loadingStaged,
    refresh: refreshStaged,
    error: stagedError,
  } = useEventStagedInventory(ownerUserId);
  const futureEventLimit = useMemo(() => {
    if (planPaused) return FREE_PLAN_EVENT_LIMIT;
    if (planTier === 'free') return FREE_PLAN_EVENT_LIMIT;
    return null;
  }, [planPaused, planTier]);
  useEffect(() => {
    if (stagedError) {
      Alert.alert('Staged inventory', stagedError);
    }
  }, [stagedError]);

  const futureEventCount = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => new Date(event.startDateISO).getTime() > now).length;
  }, [events]);

  const handleAddStagedInventory = useCallback(
    (eventId: string) => {
      if (!userId || !ownerUserId) {
        Alert.alert('Sign in required', 'Sign in to stage inventory for an event.');
        return;
      }
      router.push({ pathname: '/item-form', params: { mode: 'stage', eventId } });
    },
    [router, userId, ownerUserId],
  );

  const handleEditStagedInventory = useCallback(
    (eventId: string, stagedId: string) => {
      if (!userId || !ownerUserId) {
        Alert.alert('Sign in required', 'Sign in to update staged inventory.');
        return;
      }
      router.push({ pathname: '/item-form', params: { mode: 'stage', eventId, stagedId } });
    },
    [router, userId, ownerUserId],
  );

  const handleRemoveStagedInventory = useCallback(
    (staged: EventStagedInventoryItem) => {
      if (!userId || !ownerUserId) {
        Alert.alert('Sign in required', 'Sign in to update staged inventory.');
        return;
      }

      Alert.alert('Remove staged item?', staged.name, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventStagedInventoryItem({ userId: ownerUserId, stagedId: staged.id });
              if (staged.imagePaths.length) {
                await Promise.allSettled(staged.imagePaths.map((path) => removeItemImage(path)));
              }
            } catch (error) {
              console.error('Failed to remove staged inventory', error);
              Alert.alert('Staged inventory', 'Unable to remove the staged item right now.');
            }
          },
        },
      ]);
    },
    [userId, ownerUserId],
  );

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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskModalEventId, setTaskModalEventId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPhase, setTaskPhase] = useState<'prep' | 'live' | 'post'>('prep');
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [stagedModalEventId, setStagedModalEventId] = useState<string | null>(null);

  const phase = useMemo(() => {
    if (!events.length) return 'no-events';
    const activeEvent = events.find((event) => {
      const now = Date.now();
      const start = new Date(event.startDateISO).getTime();
      const end = new Date(event.endDateISO).getTime();
      return now >= start && now <= end;
    });
    if (activeEvent) return 'live';
    const futureEvent = events.find((event) => new Date(event.startDateISO).getTime() > Date.now());
    if (futureEvent) return 'prep';
    return 'post';
  }, [events]);

  const getEventPhase = useCallback((event: EventRecord): 'prep' | 'live' | 'post' => {
    const now = Date.now();
    const start = new Date(event.startDateISO).getTime();
    const end = new Date(event.endDateISO).getTime();
    if (now >= start && now <= end) return 'live';
    if (now < start) return 'prep';
    return 'post';
  }, []);

  const handleRefresh = useCallback(() => {
    void refreshOrders();
    void refreshInventory();
    void refreshEvents();
    void refreshStaged();
  }, [refreshEvents, refreshInventory, refreshOrders, refreshStaged]);

  useFocusEffect(
    useCallback(() => {
      if (!ownerUserId) return undefined;
      void refreshEvents();
      void refreshStaged();
      return undefined;
    }, [ownerUserId, refreshEvents, refreshStaged]),
  );

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

  const resetEventForm = useCallback(() => {
    setEditingEventId(null);
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
  }, []);

  const handleOpenEventModal = useCallback(() => {
    resetEventForm();
    setEventModalVisible(true);
  }, [resetEventForm]);

  const handleCloseEventModal = useCallback(() => {
    setEventModalVisible(false);
    resetEventForm();
  }, [resetEventForm]);

  const handleEditEvent = useCallback((event: EventRecord) => {
    setEditingEventId(event.id);
    setEventName(event.name ?? '');
    const parsedStart = (() => {
      const date = new Date(event.startDateISO);
      return Number.isNaN(date.getTime()) ? null : date;
    })();
    const parsedEnd = (() => {
      const date = new Date(event.endDateISO);
      return Number.isNaN(date.getTime()) ? null : date;
    })();
    setEventStartDate(parsedStart);
    setEventEndDate(parsedEnd ?? parsedStart ?? null);
    setEventLocation(event.location ?? '');
    setEventNotes(event.notes ?? '');
    const base = parsedStart ?? new Date();
    setPickerYear(base.getFullYear());
    setPickerMonth(base.getMonth());
    setDatePickerVisible(false);
    setDatePickerType(null);
    setEventModalVisible(true);
  }, []);

  const defaultChecklist: EventChecklistItem[] = useMemo(
    () => [
      { id: 'inventory', title: 'Confirm inventory counts', done: false, phase: 'prep' },
      { id: 'payments', title: 'Verify payment links & QR codes', done: false, phase: 'prep' },
      { id: 'marketing', title: 'Schedule social promo', done: false, phase: 'prep' },
      { id: 'booth-setup', title: 'Set up booth display', done: false, phase: 'live' },
      { id: 'cash-drawer', title: 'Count starting cash', done: false, phase: 'live' },
      { id: 'teardown', title: 'Pack inventory and signage', done: false, phase: 'post' },
      { id: 'reconcile', title: 'Reconcile sales and expenses', done: false, phase: 'post' },
    ],
    [],
  );

  const openTaskModal = useCallback(
    (eventId: string, phaseDefault: 'prep' | 'live' | 'post') => {
      setTaskModalEventId(eventId);
      setTaskTitle('');
      setTaskPhase(phaseDefault);
      setTaskModalVisible(true);
    },
    [],
  );

  const handleSaveTask = useCallback(() => {
    if (!taskModalEventId) return;
    if (!taskTitle.trim()) {
      Alert.alert('Add task', 'Enter a task name.');
      return;
    }
    if (!ownerUserId) {
      Alert.alert('Event tasks', 'Session owner not available yet.');
      return;
    }

    const title = taskTitle.trim();
    const newItem: EventChecklistItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      done: false,
      phase: taskPhase,
    };

    const target = events.find((event) => event.id === taskModalEventId);
    if (!target) {
      setTaskModalVisible(false);
      setTaskModalEventId(null);
      setTaskTitle('');
      return;
    }

    const nextChecklist = [...(target.checklist ?? []), newItem];
    setEvents((prev) =>
      prev.map((event) => (event.id === target.id ? { ...event, checklist: nextChecklist } : event)),
    );

    void updateEventRecord(ownerUserId, target.id, { checklist: nextChecklist }).catch((error) => {
      console.error('Failed to add checklist item', error);
      setEvents((prev) => prev.map((event) => (event.id === target.id ? target : event)));
      Alert.alert('Event tasks', 'Unable to save the task right now.');
    });
    setTaskModalVisible(false);
    setTaskModalEventId(null);
    setTaskTitle('');
  }, [events, ownerUserId, setEvents, taskModalEventId, taskPhase, taskTitle]);

  const daysInMonth = useMemo(() => {
    return new Date(pickerYear, pickerMonth + 1, 0).getDate();
  }, [pickerMonth, pickerYear]);

  const selectedDayForPicker = useMemo(() => {
    const activeDate = datePickerType === 'start' ? eventStartDate : eventEndDate;
    if (!activeDate) return null;
    if (activeDate.getFullYear() !== pickerYear || activeDate.getMonth() !== pickerMonth) return null;
    return activeDate.getDate();
  }, [datePickerType, eventEndDate, eventStartDate, pickerMonth, pickerYear]);

  const handleSaveEvent = useCallback(async () => {
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

    if (!ownerUserId) {
      Alert.alert('Add event', 'Session owner not available yet.');
      return;
    }

    const trimmedName = eventName.trim();
    const trimmedLocation = eventLocation.trim();
    const trimmedNotes = eventNotes.trim();
    const startISO = eventStartDate.toISOString();
    const endISO = endDateValue.toISOString();

    const isFutureEvent = eventStartDate.getTime() > Date.now();
    if (!editingEventId && isFutureEvent && futureEventLimit != null && futureEventCount >= futureEventLimit) {
      Alert.alert(
        'Plan limit reached',
        `The free plan lets you plan up to ${futureEventLimit} future event${futureEventLimit === 1 ? '' : 's'}.`,
      );
      return;
    }

    try {
      if (editingEventId) {
        const updated = await updateEventRecord(ownerUserId, editingEventId, {
          name: trimmedName,
          startDateISO: startISO,
          endDateISO: endISO,
          location: trimmedLocation ? trimmedLocation : null,
          notes: trimmedNotes ? trimmedNotes : null,
        });
        if (updated) {
          setEvents((current) =>
            [...current.map((event) => (event.id === updated.id ? updated : event))].sort(
              (a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime(),
            ),
          );
        }
      } else {
        const created = await createEvent(ownerUserId, {
          name: trimmedName,
          startDateISO: startISO,
          endDateISO: endISO,
          location: trimmedLocation ? trimmedLocation : null,
          notes: trimmedNotes ? trimmedNotes : null,
          checklist: defaultChecklist.map((item, index) => ({
            ...item,
            id: `${item.id}-${Date.now()}-${index}`,
          })),
        });
        setEvents((current) =>
          [...current, created].sort(
            (a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime(),
          ),
        );
      }
      handleCloseEventModal();
    } catch (error) {
      console.error('Failed to save event', error);
      Alert.alert('Add event', 'Unable to save this event right now.');
    }
  }, [
    defaultChecklist,
    editingEventId,
    eventEndDate,
    eventLocation,
    eventName,
    eventNotes,
    eventStartDate,
    futureEventCount,
    futureEventLimit,
    handleCloseEventModal,
    ownerUserId,
    setEvents,
  ]);

  const handleRemoveEvent = useCallback(
    (eventId: string) => {
      const targetEvent = events.find((event) => event.id === eventId);
      Alert.alert('Remove event', targetEvent ? `Remove ${targetEvent.name}?` : 'Remove this upcoming event?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (editingEventId === eventId) {
              handleCloseEventModal();
            }
            if (stagedModalEventId === eventId) {
              handleCloseStagedModal();
            }
            if (!ownerUserId) {
              Alert.alert('Remove event', 'Session owner not available yet.');
              return;
            }
            const previousEvents = events;
            setEvents((current) => current.filter((event) => event.id !== eventId));
            void Promise.all([
              deleteEventRecord(ownerUserId, eventId),
              deleteEventStagedInventoryForEvent({ userId: ownerUserId, eventId }),
            ])
              .then(() => {
                void refreshEvents();
                void refreshStaged();
              })
              .catch((error) => {
                console.error('Failed to remove event', error);
                setEvents(previousEvents);
                Alert.alert('Remove event', 'Unable to remove this event right now.');
              });
          },
        },
      ]);
    },
    [
      editingEventId,
      events,
      handleCloseEventModal,
      handleCloseStagedModal,
      ownerUserId,
      refreshEvents,
      refreshStaged,
      setEvents,
      stagedModalEventId,
      deleteEventStagedInventoryForEvent,
    ],
  );

  const combinedLoading = loadingOrders || loadingInventory || loadingEvents || loadingStaged;

  const stagedModalItems = useMemo(() => {
    if (!stagedModalEventId) return [];
    return (stagedByEvent[stagedModalEventId] ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? 0,
      priceCents: item.priceCents ?? null,
    }));
  }, [stagedByEvent, stagedModalEventId]);

  const handleCloseStagedModal = useCallback(() => {
    setStagedModalEventId(null);
  }, []);

  const handleRemoveStagedInventoryById = useCallback(
    (eventId: string, stagedId: string) => {
      const target = stagedByEvent[eventId]?.find((item) => item.id === stagedId);
      if (target) {
        handleRemoveStagedInventory(target);
      }
    },
    [handleRemoveStagedInventory, stagedByEvent],
  );

  const stagedModalEvent = useMemo(
    () => events.find((event) => event.id === stagedModalEventId) ?? null,
    [events, stagedModalEventId],
  );

  const stagedModalSubtitle = useMemo(() => {
    if (!stagedModalEvent) return null;
    return formatEventRange(stagedModalEvent.startDateISO, stagedModalEvent.endDateISO);
  }, [stagedModalEvent]);

  const handleModalEdit = useCallback(
    (stagedId: string) => {
      if (!stagedModalEventId) return;
      handleEditStagedInventory(stagedModalEventId, stagedId);
    },
    [handleEditStagedInventory, stagedModalEventId],
  );

  const handleModalRemove = useCallback(
    (stagedId: string) => {
      if (!stagedModalEventId) return;
      handleRemoveStagedInventoryById(stagedModalEventId, stagedId);
    },
    [handleRemoveStagedInventoryById, stagedModalEventId],
  );

  const handleToggleChecklistItem = useCallback(
    (eventId: string, itemId: string, done: boolean) => {
      if (!ownerUserId) return;
      const target = events.find((event) => event.id === eventId);
      if (!target) return;
      const nextChecklist = (target.checklist ?? []).map((entry) =>
        entry.id === itemId ? { ...entry, done } : entry,
      );
      setEvents((prev) =>
        prev.map((event) => (event.id === eventId ? { ...event, checklist: nextChecklist } : event)),
      );
      void updateEventRecord(ownerUserId, eventId, { checklist: nextChecklist }).catch((error) => {
        console.error('Failed to update checklist item', error);
        setEvents((prev) => prev.map((event) => (event.id === eventId ? target : event)));
      });
    },
    [events, ownerUserId, setEvents],
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
                  const stagedForEvent = stagedByEvent[event.id] ?? [];
                  const stagedItemCount = stagedForEvent.length;
                  const stagedQuantity = stagedForEvent.reduce(
                    (total, item) => total + (item.quantity ?? 0),
                    0,
                  );
                  const stagedPreviewLimit = 3;
                  const stagedPreview = stagedForEvent.slice(0, stagedPreviewLimit);
                  const stagedHasMore = stagedItemCount > stagedPreview.length;
                  return (
                    <View
                      key={event.id}
                      style={[styles.eventCard, { borderColor: theme.colors.border }]}
                    >
                      <View style={styles.eventCardHeader}>
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
                        <View style={styles.eventActions}>
                          <Pressable
                            onPress={() => handleEditEvent(event)}
                            hitSlop={10}
                            style={styles.eventActionButton}
                          >
                            <Feather name="edit-2" size={16} color={theme.colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveEvent(event.id)}
                            hitSlop={10}
                            style={styles.eventActionButton}
                          >
                            <Feather name="trash-2" size={16} color={theme.colors.error} />
                          </Pressable>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.stagedInventoryCard,
                          { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                        ]}
                      >
                        <View style={styles.stagedSummaryRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                              Pre-staged inventory
                            </Text>
                            <Text style={{ color: theme.colors.textSecondary }}>
                              {stagedItemCount
                                ? `${stagedItemCount} item${stagedItemCount === 1 ? '' : 's'} • ${stagedQuantity} unit${stagedQuantity === 1 ? '' : 's'}`
                                : 'Stage items ahead of time to prep for this event.'}
                            </Text>
                          </View>
                          <View style={styles.stagedSummaryActions}>
                            <Pressable
                              onPress={() => setStagedModalEventId(event.id)}
                              style={({ pressed }) => [
                                styles.stagedViewButton,
                                {
                                  borderColor: theme.colors.textSecondary,
                                  backgroundColor: pressed
                                    ? 'rgba(139, 149, 174, 0.18)'
                                    : 'rgba(139, 149, 174, 0.12)',
                                  opacity: stagedItemCount ? 1 : 0.7,
                                },
                              ]}
                              hitSlop={6}
                            >
                              <Feather name="list" size={14} color={theme.colors.textSecondary} />
                              <Text style={[styles.stagedViewText, { color: theme.colors.textSecondary }]}>Manage</Text>
                            </Pressable>
                          </View>
                        </View>

                        {stagedItemCount ? (
                          <View style={styles.stagedPreviewList}>
                            {stagedPreview.map((item) => {
                              const quantity = item.quantity ?? 0;
                              const quantityLabel = `${quantity} unit${quantity === 1 ? '' : 's'}`;
                              const priceLabel = formatCurrencyFromCents(item.priceCents, 'USD');
                              return (
                                <View
                                  key={item.id}
                                  style={[
                                    styles.stagedPreviewRow,
                                    {
                                      borderColor: theme.colors.border,
                                      backgroundColor: theme.colors.surface,
                                    },
                                  ]}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.stagedPreviewName, { color: theme.colors.textPrimary }]}>
                                      {item.name}
                                    </Text>
                                    <Text style={{ color: theme.colors.textSecondary }}>
                                      {quantityLabel} • {priceLabel}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                            {stagedHasMore ? (
                              <Text style={[styles.stagedPreviewMore, { color: theme.colors.textSecondary }]}>
                                + {stagedItemCount - stagedPreview.length} more staged item
                                {stagedItemCount - stagedPreview.length === 1 ? '' : 's'}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}

                        <Pressable
                          onPress={() => handleAddStagedInventory(event.id)}
                          style={({ pressed }) => [
                            styles.stagedAddButton,
                            {
                              borderColor: theme.colors.primary,
                              backgroundColor: pressed
                                ? 'rgba(101, 88, 245, 0.18)'
                                : 'rgba(101, 88, 245, 0.12)',
                            },
                          ]}
                        >
                          <Feather name="plus-circle" size={16} color={theme.colors.primary} />
                          <Text style={[styles.stagedAddText, { color: theme.colors.primary }]}>
                            Stage inventory
                          </Text>
                        </Pressable>
                      </View>
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
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>Event timeline</Text>
            <View style={styles.phaseRow}>
              <View
                style={[
                  styles.phaseItem,
                  {
                    borderColor: phase === 'prep' ? theme.colors.primary : theme.colors.border,
                    backgroundColor: phase === 'prep' ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Feather
                  name="clipboard"
                  size={16}
                  color={phase === 'prep' ? theme.colors.surface : theme.colors.textPrimary}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: phase === 'prep' ? theme.colors.surface : theme.colors.textPrimary,
                      fontWeight: '600',
                    }}
                  >
                    Prep
                  </Text>
                  <Text
                    style={{
                      color: phase === 'prep' ? theme.colors.surface : theme.colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Finalize inventory, signage, and staffing.
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.phaseItem,
                  {
                    borderColor: phase === 'live' ? theme.colors.primary : theme.colors.border,
                    backgroundColor: phase === 'live' ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Feather
                  name="zap"
                  size={16}
                  color={phase === 'live' ? theme.colors.surface : theme.colors.textPrimary}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: phase === 'live' ? theme.colors.surface : theme.colors.textPrimary,
                      fontWeight: '600',
                    }}
                  >
                    Live event
                  </Text>
                  <Text
                    style={{
                      color: phase === 'live' ? theme.colors.surface : theme.colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Track sales and adjust inventory on the fly.
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.phaseItem,
                  {
                    borderColor: phase === 'post' ? theme.colors.primary : theme.colors.border,
                    backgroundColor: phase === 'post' ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                <Feather
                  name="check-circle"
                  size={16}
                  color={phase === 'post' ? theme.colors.surface : theme.colors.textPrimary}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: phase === 'post' ? theme.colors.surface : theme.colors.textPrimary,
                      fontWeight: '600',
                    }}
                  >
                    Wrap-up
                  </Text>
                  <Text
                    style={{
                      color: phase === 'post' ? theme.colors.surface : theme.colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Log expenses, restock, and capture notes for next time.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {events.length ? (
            <View
              style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>Event prep</Text>
              {events.map((event) => {
                const expanded = expandedEvents[event.id] ?? false;
                const eventPhase = getEventPhase(event);
                const phaseLabel =
                  eventPhase === 'prep' ? 'Prep tasks' : eventPhase === 'live' ? 'Live tasks' : 'Wrap-up tasks';
                const filteredChecklist = (event.checklist ?? []).filter((item) => item.phase === eventPhase);
                const remainingCount = (event.checklist ?? []).filter((item) => item.phase !== eventPhase).length;

                return (
                  <View key={`${event.id}-prep`} style={styles.prepCard}>
                    <Pressable
                      onPress={() =>
                        setExpandedEvents((prev) => ({
                          ...prev,
                          [event.id]: !(prev[event.id] ?? false),
                        }))
                      }
                      style={({ pressed }) => [
                        styles.prepHeader,
                        {
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prepTitle, { color: theme.colors.textPrimary }]}>{event.name}</Text>
                        <Text style={{ color: theme.colors.textSecondary }}>
                          {formatEventRange(event.startDateISO, event.endDateISO)}
                        </Text>
                      </View>
                      <View style={styles.prepHeaderActions}>
                        <Feather
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.colors.textSecondary}
                        />
                        <Pressable onPress={() => handleEditEvent(event)} hitSlop={10}>
                          <Feather name="edit-2" size={16} color={theme.colors.primary} />
                        </Pressable>
                        <Pressable onPress={() => handleRemoveEvent(event.id)} hitSlop={10}>
                          <Feather name="trash-2" size={16} color={theme.colors.error} />
                        </Pressable>
                      </View>
                    </Pressable>

                    {expanded ? (
                      <>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8 }}>{phaseLabel}</Text>
                        {filteredChecklist.length ? (
                          <View style={{ gap: 8 }}>
                            {filteredChecklist.map((item) => (
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
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: item.done ? theme.colors.textMuted : theme.colors.textPrimary,
                                      textDecorationLine: item.done ? 'line-through' : 'none',
                                    }}
                                  >
                                    {item.title}
                                  </Text>
                                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                    Tap to mark as {item.done ? 'incomplete' : 'done'}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text style={{ color: theme.colors.textSecondary }}>No tasks for this phase yet.</Text>
                        )}
                        {remainingCount ? (
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                            {remainingCount} task{remainingCount === 1 ? '' : 's'} saved for other phases.
                          </Text>
                        ) : null}
                        <Pressable
                          onPress={() => openTaskModal(event.id, eventPhase)}
                          style={({ pressed }) => [
                            styles.addTaskButton,
                            {
                              borderColor: theme.colors.border,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                        >
                          <Feather name="plus" size={14} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>Add task</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={eventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (datePickerVisible) {
            setDatePickerVisible(false);
            setDatePickerType(null);
            return;
          }
          handleCloseEventModal();
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboardAvoid}>
          <View style={styles.modalOverlay}>
            <View style={[styles.fullModalCard, { backgroundColor: theme.colors.background }]}>
              <SafeAreaView edges={['top']} style={styles.fullModalSafeArea}>
                <View style={styles.fullModalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                    {editingEventId ? 'Edit event' : 'Add event'}
                  </Text>
                  <Pressable onPress={handleCloseEventModal} hitSlop={12}>
                    <Feather name="x" size={18} color={theme.colors.textMuted} />
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
                    onChangeText={setEventName}
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
                    onChangeText={setEventLocation}
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
              </ScrollView>
              <SafeAreaView edges={['bottom']} style={styles.fullModalFooterSafeArea}>
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
                  <Text style={[styles.modalPrimaryText, { color: theme.colors.surface }]}>
                    {editingEventId ? 'Save changes' : 'Save event'}
                  </Text>
                </Pressable>
              </SafeAreaView>
            </View>

            {datePickerVisible ? (
              <View style={styles.datePickerOverlay}>
                <Pressable
                  style={styles.datePickerBackdrop}
                  onPress={() => {
                    setDatePickerVisible(false);
                    setDatePickerType(null);
                  }}
                />
                <View style={[styles.datePickerCard, { backgroundColor: theme.colors.surface }]}
                >
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
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={taskModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTaskModalVisible(false);
          setTaskModalEventId(null);
          setTaskTitle('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Add event task</Text>
              <Pressable
                onPress={() => {
                  setTaskModalVisible(false);
                  setTaskModalEventId(null);
                  setTaskTitle('');
                }}
                hitSlop={12}
              >
                <Feather name="x" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.modalField}>
              <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Task</Text>
              <TextInput
                value={taskTitle}
                onChangeText={setTaskTitle}
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
                      onPress={() => setTaskPhase(option)}
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
              onPress={handleSaveTask}
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

      <StagedInventoryModal
        visible={Boolean(stagedModalEventId)}
        onClose={handleCloseStagedModal}
        title={stagedModalEvent?.name ?? 'Staged inventory'}
        subtitle={stagedModalSubtitle}
        items={stagedModalItems}
        loading={loadingStaged}
        emptyMessage="No staged inventory yet. Use “Stage inventory” to add items ahead of time."
        onEdit={stagedModalEventId ? handleModalEdit : undefined}
        onRemove={stagedModalEventId ? handleModalRemove : undefined}
      />

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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    alignSelf: 'stretch',
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
    alignItems: 'center',
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
    gap: 12,
    alignSelf: 'stretch',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventActionButton: {
    padding: 4,
    borderRadius: 999,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
  },
  eventNotes: {
    marginTop: 6,
    fontSize: 13,
  },
  stagedInventoryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignSelf: 'stretch',
  },
  stagedSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stagedSummaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stagedPreviewList: {
    gap: 8,
  },
  stagedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  stagedPreviewName: {
    fontSize: 13,
    fontWeight: '600',
  },
  stagedPreviewMore: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  prepHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stagedViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stagedLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stagedViewText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stagedAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
  },
  stagedAddText: {
    fontSize: 13,
    fontWeight: '600',
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
  phaseRow: {
    flexDirection: 'column',
    gap: 10,
  },
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  addTaskButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phaseToggleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    zIndex: 1,
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
  modalKeyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  datePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
