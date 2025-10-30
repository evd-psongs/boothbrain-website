import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useSession } from '@/providers/SessionProvider';
import { useInventory } from '@/hooks/useInventory';
import { useEventStagedInventory } from '@/hooks/useEventStagedInventory';
import { useEvents } from '@/hooks/useEvents';
import { supabase } from '@/lib/supabase';
import type { EventRecord } from '@/types/events';
import type { EventStagedInventoryItem, InventoryItem } from '@/types/inventory';
import { buildInventoryCsv, parseInventoryCsv } from '@/utils/inventoryCsv';
import { createInventoryItem, updateInventoryItem } from '@/lib/inventory';
import {
  deleteEventStagedInventoryForEvent,
  updateEventStagedInventoryStatus,
  loadStagedInventoryItems,
} from '@/lib/eventStagedInventory';
import { deleteEventRecord } from '@/lib/events';
import { formatCurrencyFromCents } from '@/utils/currency';
import { formatEventRange } from '@/utils/dates';
import { StagedInventoryModal } from '@/components/StagedInventoryModal';
import { FREE_PLAN_ITEM_LIMIT } from '@/lib/freePlanLimits';

type FeedbackState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

type SummaryFilter = 'all' | 'low' | 'out';

type SummaryStat = {
  label: string;
  value: number | string;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
  subtle: string;
  subtleActive: string;
  filter: SummaryFilter;
};

const mapEventRowToRecord = (row: any): EventRecord => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  name: row.name,
  startDateISO: row.start_date,
  endDateISO: row.end_date,
  location: row.location ?? null,
  notes: row.notes ?? null,
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

type InventoryListItemProps = {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
};

export default function InventoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession, sharedOwnerId, sharedPlanTier, sharedPlanPaused } = useSession();

  const [searchQuery, setSearchQuery] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [importOptionsVisible, setImportOptionsVisible] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [stagedModalEventId, setStagedModalEventId] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const ownerUserId = sharedOwnerId ?? userId;
  const { items, loading, error, refresh } = useInventory(ownerUserId);
  const {
    stagedByEvent,
    loading: loadingStaged,
    error: stagedError,
    refresh: refreshStaged,
  } = useEventStagedInventory(ownerUserId);
  const { events: upcomingEvents, refresh: refreshEvents } = useEvents(ownerUserId);
  const [stagedEventFallbacks, setStagedEventFallbacks] = useState<Record<string, EventRecord>>({});

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (error) {
      setFeedback({ type: 'error', message: error });
    }
  }, [error]);

  useEffect(() => {
    if (stagedError) {
      setFeedback({ type: 'error', message: stagedError });
    }
  }, [stagedError]);

  useFocusEffect(
    useCallback(() => {
      if (!ownerUserId) return undefined;
      void refresh();
      void refreshStaged();
      void refreshEvents();
      return undefined;
    }, [refresh, refreshEvents, refreshStaged, ownerUserId]),
  );

  const planTier = sharedPlanTier;
  const planPaused = sharedPlanPaused;
  const planItemLimit = useMemo(() => {
    if (planPaused) return FREE_PLAN_ITEM_LIMIT;
    if (planTier === 'free') return FREE_PLAN_ITEM_LIMIT;
    if (!currentSession || currentSession.isHost) {
      const fromPlan = user?.subscription?.plan?.maxInventoryItems;
      if (typeof fromPlan === 'number' && fromPlan > 0) {
        return fromPlan;
      }
    }
    return null;
  }, [planPaused, planTier, currentSession?.isHost, user?.subscription?.plan?.maxInventoryItems]);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.quantity > 0 && item.quantity <= Math.max(item.lowStockThreshold, 0)),
    [items],
  );

  const outOfStockItems = useMemo(() => items.filter((item) => item.quantity <= 0), [items]);

  const stagedEventIds = useMemo(() => Object.keys(stagedByEvent), [stagedByEvent]);

  const missingEventIds = useMemo(() => {
    if (!stagedEventIds.length) return [] as string[];
    return stagedEventIds.filter((eventId) => {
      const known = upcomingEvents.some((event) => event.id === eventId) || Boolean(stagedEventFallbacks[eventId]);
      return !known;
    });
  }, [stagedEventIds, upcomingEvents, stagedEventFallbacks]);

  useEffect(() => {
    if (!ownerUserId || missingEventIds.length === 0) return;

    let cancelled = false;

    const fetchMissingEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, owner_user_id, name, start_date, end_date, location, notes, checklist, created_at, updated_at')
        .in('id', missingEventIds);

      if (cancelled || error || !data?.length) {
        if (error) {
          console.warn('Failed to backfill staged event metadata', error);
        }
        return;
      }

      setStagedEventFallbacks((current) => {
        const next = { ...current };
        data.forEach((row: any) => {
          const mapped = mapEventRowToRecord(row);
          next[mapped.id] = mapped;
        });
        return next;
      });
    };

    void fetchMissingEvents();

    return () => {
      cancelled = true;
    };
  }, [ownerUserId, missingEventIds]);

  const eventsById = useMemo(() => {
    const map: Record<string, EventRecord> = {};
    upcomingEvents.forEach((event) => {
      map[event.id] = event;
    });
    Object.keys(stagedEventFallbacks).forEach((eventId) => {
      map[eventId] = stagedEventFallbacks[eventId];
    });
    return map;
  }, [upcomingEvents, stagedEventFallbacks]);

  const stagedEventEntries = useMemo(() => {
    const now = Date.now();
    return Object.entries(stagedByEvent)
      .map(([eventId, stagedList]) => {
        const event = eventsById[eventId];
        const totalQuantity = stagedList.reduce((sum, staged) => sum + (staged.quantity ?? 0), 0);
        const totalValueCents = stagedList.reduce(
          (sum, staged) => sum + (staged.priceCents ?? 0) * (staged.quantity ?? 0),
          0,
        );
        const isPastEvent = event ? new Date(event.endDateISO).getTime() < now : false;
        return {
          eventId,
          event,
          items: stagedList,
          totalQuantity,
          totalValueCents,
          isPastEvent,
        };
      })
      .sort((a, b) => {
        const aTime = a.event ? new Date(a.event.startDateISO).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.event ? new Date(b.event.startDateISO).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
  }, [eventsById, stagedByEvent]);

  const totalStagedCount = useMemo(() => {
    return Object.values(stagedByEvent).reduce((sum, list) => sum + list.length, 0);
  }, [stagedByEvent]);

  const totalTrackedCount = useMemo(() => items.length + totalStagedCount, [items.length, totalStagedCount]);

  const stagedModalItems = useMemo(() => {
    if (!stagedModalEventId) return [];
    return (stagedByEvent[stagedModalEventId] ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? 0,
      priceCents: item.priceCents ?? null,
    }));
  }, [stagedByEvent, stagedModalEventId]);

  const stagedModalEntry = useMemo(
    () => stagedEventEntries.find((entry) => entry.eventId === stagedModalEventId) ?? null,
    [stagedEventEntries, stagedModalEventId],
  );

  const stagedModalSubtitle = useMemo(() => {
    if (!stagedModalEntry?.event) return null;
    return formatEventRange(stagedModalEntry.event.startDateISO, stagedModalEntry.event.endDateISO);
  }, [stagedModalEntry]);

  const handleCloseStagedModal = useCallback(() => {
    setStagedModalEventId(null);
  }, []);

  const handleLoadAllForEvent = useCallback(
    (eventId: string) => {
      if (!ownerUserId) {
        setFeedback({ type: 'error', message: 'Session owner not available yet.' });
        return;
      }

      const itemsForEvent = stagedByEvent[eventId] ?? [];
      if (!itemsForEvent.length) {
        Alert.alert('No staged inventory', 'Stage items for this event before loading.');
        return;
      }

      const eventName = eventsById[eventId]?.name ?? 'this event';
      Alert.alert(
        'Load staged inventory?',
        `Load ${itemsForEvent.length} staged item${itemsForEvent.length === 1 ? '' : 's'} for ${eventName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Load',
            style: 'default',
            onPress: async () => {
              try {
                await loadStagedInventoryItems({ userId: ownerUserId, eventId, items: itemsForEvent });
                if (stagedModalEventId === eventId) {
                  handleCloseStagedModal();
                }
                void refresh();
                void refreshStaged();
                setFeedback({
                  type: 'success',
                  message: `Loaded ${itemsForEvent.length} item${itemsForEvent.length === 1 ? '' : 's'} into inventory.`,
                });
              } catch (error) {
                console.error('Failed to load staged inventory', error);
                setFeedback({ type: 'error', message: 'Unable to load staged inventory right now.' });
              }
            },
          },
        ],
      );
    },
    [
      eventsById,
      handleCloseStagedModal,
      loadStagedInventoryItems,
      refresh,
      refreshStaged,
      setFeedback,
      stagedByEvent,
      stagedModalEventId,
      ownerUserId,
    ],
  );

  const handleRemoveEvent = useCallback(
    (eventId: string) => {
      const eventName = eventsById[eventId]?.name;
      Alert.alert('Remove event', eventName ? `Remove ${eventName}?` : 'Remove this event?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!ownerUserId) {
              setFeedback({ type: 'error', message: 'Session owner not available yet.' });
              return;
            }

            try {
              await Promise.all([
                deleteEventRecord(ownerUserId, eventId),
                deleteEventStagedInventoryForEvent({ userId: ownerUserId, eventId }),
              ]);
              setFeedback({ type: 'success', message: 'Event removed.' });
              void refreshEvents();
              void refreshStaged();
              if (stagedModalEventId === eventId) {
                handleCloseStagedModal();
              }
            } catch (error) {
              console.error('Failed to remove event', error);
              setFeedback({ type: 'error', message: 'Unable to remove this event right now.' });
            }
          },
        },
      ]);
    },
    [
      eventsById,
      handleCloseStagedModal,
      ownerUserId,
      refreshEvents,
      refreshStaged,
      setFeedback,
      stagedModalEventId,
      deleteEventStagedInventoryForEvent,
    ],
  );

  const stats = useMemo<SummaryStat[]>(() => {
    return [
      {
        label: 'Total items',
        value: planItemLimit != null ? `${totalTrackedCount}/${planItemLimit}` : totalTrackedCount,
        icon: 'box',
        accent: theme.colors.primary,
        subtle: 'rgba(248, 249, 255, 0.18)',
        subtleActive: 'rgba(255, 255, 255, 0.28)',
        filter: 'all',
      },
      {
        label: 'Low stock',
        value: lowStockItems.length,
        icon: 'alert-triangle',
        accent: theme.colors.warning,
        subtle: 'rgba(247, 181, 0, 0.12)',
        subtleActive: 'rgba(247, 181, 0, 0.26)',
        filter: 'low',
      },
      {
        label: 'Out of stock',
        value: outOfStockItems.length,
        icon: 'x-octagon',
        accent: theme.colors.error,
        subtle: 'rgba(243, 105, 110, 0.12)',
        subtleActive: 'rgba(243, 105, 110, 0.26)',
        filter: 'out',
      },
    ];
  }, [lowStockItems.length, outOfStockItems.length, planItemLimit, theme.colors.error, theme.colors.primary, theme.colors.warning, totalTrackedCount]);

  const filteredItems = useMemo(() => {
    const base =
      summaryFilter === 'low'
        ? lowStockItems
        : summaryFilter === 'out'
          ? outOfStockItems
          : items;
    if (!searchQuery.trim()) {
      return base;
    }
    const query = searchQuery.trim().toLowerCase();
    return base.filter(
      (item) =>
        item.name.toLowerCase().includes(query)
        || (item.sku ? item.sku.toLowerCase().includes(query) : false),
    );
  }, [items, lowStockItems, outOfStockItems, searchQuery, summaryFilter]);

  const handleSummarySelect = useCallback((filter: SummaryFilter) => {
    setSummaryFilter((current) => (current === filter ? 'all' : filter));
  }, []);

  const handleNewItem = useCallback(() => {
    router.push('/item-form');
  }, [router]);

  const handleEditStagedItem = useCallback(
    (eventId: string, stagedId: string) => {
      if (!userId || !ownerUserId) {
        setFeedback({ type: 'error', message: 'Session owner not available yet.' });
        return;
      }
      router.push({ pathname: '/item-form', params: { mode: 'stage', eventId, stagedId } });
    },
    [router, userId, ownerUserId],
  );

  const handleReleaseStagedItem = useCallback(
    async (staged: EventStagedInventoryItem) => {
      if (!userId || !ownerUserId) {
        setFeedback({ type: 'error', message: 'Session owner not available yet.' });
        return;
      }
      try {
        await updateEventStagedInventoryStatus({
          userId: ownerUserId,
          stagedId: staged.id,
          status: 'released',
          convertedItemId: null,
        });
        setFeedback({ type: 'success', message: 'Staged item released.' });
      } catch (releaseError) {
        console.error('Failed to release staged inventory', releaseError);
        setFeedback({ type: 'error', message: 'Unable to release staged inventory right now.' });
      }
    },
    [userId, ownerUserId],
  );

  const handleReleaseStagedItemById = useCallback(
    (eventId: string, stagedId: string) => {
      const target = stagedByEvent[eventId]?.find((item) => item.id === stagedId);
      if (target) {
        void handleReleaseStagedItem(target);
      }
    },
    [handleReleaseStagedItem, stagedByEvent],
  );

  const applyInventoryRows = useCallback(
    async (rows: ReturnType<typeof parseInventoryCsv>) => {
      if (!ownerUserId || !rows.length) return;

      const existingBySku = new Map<string, InventoryItem>();
      const existingByName = new Map<string, InventoryItem>();
      items.forEach((item) => {
        if (item.sku) {
          existingBySku.set(item.sku.toLowerCase(), item);
        }
        existingByName.set(item.name.toLowerCase(), item);
      });

      let created = 0;
      let updated = 0;
      const skipped: string[] = [];

      for (const row of rows) {
        const normalizedSku = row.sku ? row.sku.toLowerCase() : null;
        const normalizedName = row.name.toLowerCase();
        const existing = normalizedSku
          ? existingBySku.get(normalizedSku) ?? existingByName.get(normalizedName)
          : existingByName.get(normalizedName);

        const input = {
          name: row.name,
          sku: row.sku,
          priceCents: row.priceCents,
          quantity: Math.max(0, row.quantity),
          lowStockThreshold: Math.max(0, row.lowStockThreshold),
          sessionId: currentSession?.eventId ?? null,
          imagePaths: existing?.imagePaths ?? [],
        };

        try {
          if (existing) {
            await updateInventoryItem({ userId: ownerUserId, itemId: existing.id, input });
            updated += 1;
          } else {
            if (planItemLimit != null && totalTrackedCount + created >= planItemLimit) {
              skipped.push(`${row.name} (plan limit reached)`);
              continue;
            }
            await createInventoryItem({ userId: ownerUserId, input });
            created += 1;
          }
        } catch (importError) {
          console.error('Failed to import row', row.name, importError);
          skipped.push(row.name);
        }
      }

      await refresh();

      const summary: string[] = [];
      if (created) summary.push(`${created} added`);
      if (updated) summary.push(`${updated} updated`);
      if (!summary.length) summary.push('No changes applied');

      setLastImportSummary({ created, updated, skipped: skipped.length });

      let message = `Import complete: ${summary.join(', ')}`;
      if (skipped.length) {
        const preview = skipped.slice(0, 3).join(', ');
        message += `. Skipped: ${preview}${skipped.length > 3 ? ` (+${skipped.length - 3} more)` : ''}`;
      }

      setFeedback({ type: skipped.length ? 'info' : 'success', message });
    },
    [items, currentSession?.eventId, planItemLimit, refresh, totalTrackedCount, ownerUserId],
  );

  const handleImportCsv = useCallback(async () => {
    if (!userId || !ownerUserId) {
      setFeedback({ type: 'error', message: 'Session owner not available yet.' });
      return;
    }

    try {
      setIsProcessingImport(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const contents = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      const rows = parseInventoryCsv(contents);

      if (!rows.length) {
        setFeedback({ type: 'info', message: 'No inventory rows were found in that file.' });
        return;
      }

      await applyInventoryRows(rows);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Failed to import inventory.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsProcessingImport(false);
    }
  }, [applyInventoryRows, userId, ownerUserId]);

  const handleExportCsv = useCallback(async () => {
    if (!filteredItems.length) {
      setFeedback({ type: 'info', message: 'No items match the current filters to export.' });
      return;
    }

    try {
      setIsExporting(true);
      const csv = buildInventoryCsv(filteredItems);
      const directory = FileSystem.documentDirectory;
      if (!directory) {
        throw new Error('Storage is unavailable on this device.');
      }
      const filename = `boothbrain-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      const fileUri = `${directory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      await Share.share({ url: fileUri, title: filename, message: filename });
      setFeedback({ type: 'success', message: `Exported ${filteredItems.length} items.` });
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Failed to export inventory.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems]);

  const handleImportCsvFile = useCallback(async () => {
    setImportOptionsVisible(false);
    setImportError(null);
    await handleImportCsv();
  }, [handleImportCsv]);

  const normalizeGoogleSheetUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error('Enter a Google Sheets link to import.');
    }
    if (trimmed.includes('export?format=csv') || trimmed.includes('output=csv')) {
      return trimmed;
    }

    const publishedMatch = trimmed.match(/https?:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (publishedMatch) {
      return `${trimmed.replace(/\/pub.*$/, '')}/pub?output=csv`;
    }

    const match = trimmed.match(/https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error('Link must be a shared Google Sheets URL.');
    }

    const gidMatch = trimmed.match(/[?&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
  }, []);

  const handleImportFromGoogleSheets = useCallback(async () => {
    if (!userId) {
      setFeedback({ type: 'error', message: 'Sign in to import inventory.' });
      return;
    }

    try {
      setIsProcessingImport(true);
      setImportError(null);
      const normalizedUrl = normalizeGoogleSheetUrl(googleSheetUrl);
      const response = await fetch(normalizedUrl);
      if (!response.ok) {
        throw new Error('Unable to download Google Sheet. Check sharing settings.');
      }
      const csvText = await response.text();
      const rows = parseInventoryCsv(csvText);
      if (!rows.length) {
        setFeedback({ type: 'info', message: 'No inventory rows were found in that sheet.' });
        return;
      }
      setImportOptionsVisible(false);
      setGoogleSheetUrl('');
      await applyInventoryRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import from Google Sheets.';
      setImportError(message);
      setFeedback({ type: 'error', message });
    } finally {
      setIsProcessingImport(false);
    }
  }, [userId, googleSheetUrl, normalizeGoogleSheetUrl, applyInventoryRows]);


  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => (
      <InventoryListItem
        item={item}
        onPress={() => router.push({ pathname: '/item-form', params: { itemId: item.id } })}
        themeColors={theme.colors}
      />
    ),
    [router, theme.colors],
  );

  const keyExtractor = useCallback((item: InventoryItem) => item.id, []);

  const listEmpty = !loading && !filteredItems.length;

  const handleModalEdit = useCallback(
    (stagedId: string) => {
      if (!stagedModalEventId) return;
      handleEditStagedItem(stagedModalEventId, stagedId);
    },
    [handleEditStagedItem, stagedModalEventId],
  );

  const handleModalRelease = useCallback(
    (stagedId: string) => {
      if (!stagedModalEventId) return;
      handleReleaseStagedItemById(stagedModalEventId, stagedId);
    },
    [handleReleaseStagedItemById, stagedModalEventId],
  );

  const handleModalLoadAll = useCallback(() => {
    if (!stagedModalEventId) return;
    handleLoadAllForEvent(stagedModalEventId);
  }, [handleLoadAllForEvent, stagedModalEventId]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        {feedback ? (
          <FeedbackBanner
            feedback={feedback}
            successColor={theme.colors.success}
            errorColor={theme.colors.error}
            infoColor={theme.colors.primary}
          />
        ) : null}

        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroHeader}>
            <Text style={[styles.heroTitle, { color: theme.colors.surface }]}>Inventory overview</Text>
            <Pressable onPress={handleNewItem} style={styles.heroButton}>
              <Feather name="plus" size={16} color={theme.colors.primary} />
              <Text style={[styles.heroButtonText, { color: theme.colors.primary }]}>New item</Text>
            </Pressable>
          </View>
          <View style={styles.statRow}>
            {stats.map((stat) => {
              const isActive = summaryFilter === stat.filter;
              return (
                <Pressable
                  key={stat.label}
                  onPress={() => handleSummarySelect(stat.filter)}
                  style={({ pressed }) => [
                    styles.statCard,
                    {
                      backgroundColor: isActive ? stat.subtleActive : stat.subtle,
                      borderColor: isActive ? stat.accent : 'rgba(248, 249, 255, 0.18)',
                      opacity: pressed ? 0.92 : 1,
                    },
                    pressed ? { transform: [{ scale: 0.98 }] } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={[styles.statIcon, { backgroundColor: stat.accent }]}>
                    <Feather name={stat.icon} size={16} color={theme.colors.surface} />
                  </View>
                  <Text style={[styles.statValue, styles.heroStatValue]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, styles.heroStatLabel]}>{stat.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {stagedEventEntries.length ? (
          <View
            style={[styles.stagingCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Staged for events</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                  Load prepped items into live inventory when you arrive on-site.
                </Text>
              </View>
            </View>

            {loadingStaged ? (
              <View style={styles.stagingLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {stagedEventEntries.map((entry) => {
                  const { event, totalQuantity, totalValueCents, isPastEvent } = entry;
                  const formattedRange = event
                    ? formatEventRange(event.startDateISO, event.endDateISO)
                    : 'Event removed';
                  const eventTitle = event ? event.name : 'Event removed';
                  const subtitle = event
                    ? isPastEvent
                      ? `${formattedRange} • Event ended`
                      : formattedRange
                    : 'Event removed';
                  const itemCount = entry.items.length;
                  return (
                    <View
                      key={entry.eventId}
                      style={[styles.stagedEventCard, { borderColor: theme.colors.border }]}
                    >
                      <View style={styles.stagedEventHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.stagedEventTitleRow}>
                            <Text style={[styles.stagedEventTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                              {eventTitle}
                            </Text>
                            {isPastEvent ? (
                              <View style={[styles.stagedEventChip, { borderColor: theme.colors.border }]}>
                                <Text style={[styles.stagedEventChipLabel, { color: theme.colors.textSecondary }]}>Ended</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={{ color: theme.colors.textSecondary }}>{subtitle}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                            {totalQuantity} unit{totalQuantity === 1 ? '' : 's'}
                          </Text>
                          <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>
                            {totalValueCents > 0
                              ? formatCurrencyFromCents(totalValueCents, 'USD')
                              : 'Value pending'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.stagedEventSummaryRow}>
                        <Text style={{ color: theme.colors.textSecondary }}>
                          {itemCount
                            ? `${itemCount} item${itemCount === 1 ? '' : 's'} staged`
                            : 'No staged inventory yet.'}
                        </Text>
                        <View style={styles.stagedEventSummaryActions}>
                          {itemCount ? (
                            <Pressable
                              onPress={() => handleLoadAllForEvent(entry.eventId)}
                              style={({ pressed }) => [
                                styles.stagedLoadAllButton,
                                {
                                  borderColor: theme.colors.primary,
                                  backgroundColor: pressed
                                    ? 'rgba(101, 88, 245, 0.16)'
                                    : 'rgba(101, 88, 245, 0.12)',
                                },
                              ]}
                            >
                              <Feather name="log-in" size={14} color={theme.colors.primary} />
                              <Text style={[styles.stagedActionLabel, { color: theme.colors.primary }]}>Load all</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => setStagedModalEventId(entry.eventId)}
                            style={({ pressed }) => [
                              styles.stagedActionButton,
                              {
                                borderColor: theme.colors.textSecondary,
                                backgroundColor: pressed
                                  ? 'rgba(139, 149, 174, 0.16)'
                                  : 'rgba(139, 149, 174, 0.12)',
                                opacity: itemCount ? 1 : 0.7,
                              },
                            ]}
                          >
                            <Feather name="list" size={14} color={theme.colors.textSecondary} />
                            <Text style={[styles.stagedActionLabel, { color: theme.colors.textSecondary }]}>Manage</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveEvent(entry.eventId)}
                            style={({ pressed }) => [
                              styles.stagedActionButton,
                              {
                                borderColor: theme.colors.error,
                                backgroundColor: pressed
                                  ? 'rgba(243, 105, 110, 0.16)'
                                  : 'rgba(243, 105, 110, 0.12)',
                              },
                            ]}
                          >
                            <Feather name="trash-2" size={14} color={theme.colors.error} />
                            <Text style={[styles.stagedActionLabel, { color: theme.colors.error }]}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <View style={styles.toolbarActions}>
            <Pressable
              onPress={() => {
                setImportOptionsVisible(true);
                setImportError(null);
              }}
              disabled={isProcessingImport}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: theme.colors.primary, opacity: pressed || isProcessingImport ? 0.7 : 1 },
              ]}
            >
              {isProcessingImport ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Feather name="upload" size={14} color={theme.colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>Import CSV</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleExportCsv}
              disabled={isExporting}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: theme.colors.primary, opacity: pressed || isExporting ? 0.7 : 1 },
              ]}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Feather name="download" size={14} color={theme.colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>Export CSV</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Feather name="search" size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search items or SKU"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, { color: theme.colors.textPrimary }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={12}>
                <Feather name="x" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {lastImportSummary ? (
          <View style={[styles.summaryCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>Last import</Text>
              <Pressable onPress={() => setLastImportSummary(null)} hitSlop={12}>
                <Feather name="x" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.summaryRow}>
              <SummaryPill label="Added" value={lastImportSummary.created} color={theme.colors.success} subtle="rgba(45, 186, 127, 0.12)" />
              <SummaryPill label="Updated" value={lastImportSummary.updated} color={theme.colors.primary} subtle="rgba(101, 88, 245, 0.12)" />
              <SummaryPill label="Skipped" value={lastImportSummary.skipped} color={theme.colors.warning} subtle="rgba(247, 181, 0, 0.12)" />
            </View>
          </View>
        ) : null}

        <FlatList
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            listEmpty ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={28} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No items yet</Text>
                <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>Add your first product or import from CSV to get started.</Text>
              </View>
            ) : null
          }
          refreshControl={(
            <RefreshControl
              refreshing={loading || loadingStaged}
              onRefresh={() => {
                void refresh();
                void refreshStaged();
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          )}
        />
      </View>

      <Modal visible={importOptionsVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Import inventory</Text>
              <Pressable onPress={() => setImportOptionsVisible(false)} hitSlop={12}>
                <Feather name="x" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]}>
              Import from a CSV file or paste a Google Sheets link that anyone with the link can view.
            </Text>

            <Pressable
              onPress={handleImportCsvFile}
              disabled={isProcessingImport}
              style={({ pressed }) => [
                styles.modalAction,
                { borderColor: theme.colors.primary, backgroundColor: pressed ? 'rgba(101, 88, 245, 0.12)' : 'transparent' },
              ]}
            >
              {isProcessingImport ? (
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
                  setGoogleSheetUrl(text);
                  if (importError) setImportError(null);
                }}
                placeholder="https://docs.google.com/..."
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.modalTextInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              />
              {importError ? <Text style={[styles.modalError, { color: theme.colors.error }]}>{importError}</Text> : null}
              <Pressable
                onPress={handleImportFromGoogleSheets}
                disabled={isProcessingImport}
                style={({ pressed }) => [
                  styles.modalConfirm,
                  { backgroundColor: theme.colors.primary, opacity: pressed || isProcessingImport ? 0.8 : 1 },
                ]}
              >
                {isProcessingImport ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: theme.colors.surface }]}>Import from Sheets</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <StagedInventoryModal
        visible={Boolean(stagedModalEventId)}
        onClose={handleCloseStagedModal}
        title={stagedModalEntry?.event?.name ?? 'Staged inventory'}
        subtitle={stagedModalSubtitle}
        items={stagedModalItems}
        loading={loadingStaged}
        emptyMessage="No staged inventory yet. Use the event screen to stage items ahead of time."
        onLoadAll={stagedModalEventId ? handleModalLoadAll : undefined}
        onEdit={stagedModalEventId ? handleModalEdit : undefined}
        onRelease={stagedModalEventId ? handleModalRelease : undefined}
        releaseLabel="Release"
      />

      <Modal visible={(isProcessingImport || isExporting) && !importOptionsVisible} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>
              {isProcessingImport ? 'Importing inventory…' : 'Preparing export…'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FeedbackBanner({
  feedback,
  successColor,
  errorColor,
  infoColor,
}: {
  feedback: FeedbackState;
  successColor: string;
  errorColor: string;
  infoColor: string;
}) {
  if (!feedback) return null;
  const palette =
    feedback.type === 'success'
      ? { border: successColor, background: 'rgba(45, 186, 127, 0.12)', text: successColor }
      : feedback.type === 'error'
      ? { border: errorColor, background: 'rgba(243, 105, 110, 0.12)', text: errorColor }
      : { border: infoColor, background: 'rgba(101, 88, 245, 0.12)', text: infoColor };

  return (
    <View style={[styles.feedbackBanner, { borderColor: palette.border, backgroundColor: palette.background }]}>
      <Text style={[styles.feedbackText, { color: palette.text }]}>{feedback.message}</Text>
    </View>
  );
}

function InventoryListItem({ item, onPress, themeColors }: InventoryListItemProps) {
  const isOutOfStock = item.quantity <= 0;
  const isLowStock = !isOutOfStock && item.quantity <= Math.max(item.lowStockThreshold, 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.itemCard, { borderColor: themeColors.border, opacity: pressed ? 0.85 : 1 }]}
      onPress={() => onPress(item)}
    >
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.sku ? (
            <Text style={[styles.itemSku, { color: themeColors.textMuted }]}>SKU {item.sku}</Text>
          ) : null}
        </View>
        <Text style={[styles.itemPrice, { color: themeColors.textPrimary }]}>
          ${(item.priceCents / 100).toFixed(2)}
        </Text>
      </View>

      <View style={styles.itemMeta}>
        <View style={styles.badge}>
          <Feather name="package" size={12} color={themeColors.primary} />
          <Text style={[styles.badgeText, { color: themeColors.primary }]}>Qty {item.quantity}</Text>
        </View>
        <View style={styles.badge}>
          <Feather name="flag" size={12} color={themeColors.textSecondary} />
          <Text style={[styles.badgeText, { color: themeColors.textSecondary }]}>Low stock {item.lowStockThreshold}</Text>
        </View>
      </View>

      {isLowStock ? (
        <View style={[styles.statusPill, { backgroundColor: 'rgba(247, 181, 0, 0.16)' }]}>
          <Feather name="alert-triangle" size={12} color={themeColors.warning} />
          <Text style={[styles.statusText, { color: themeColors.warning }]}>Low stock</Text>
        </View>
      ) : null}

      {isOutOfStock ? (
        <View style={[styles.statusPill, { backgroundColor: 'rgba(243, 105, 110, 0.12)' }]}>
          <Feather name="x-octagon" size={12} color={themeColors.error} />
          <Text style={[styles.statusText, { color: themeColors.error }]}>Out of stock</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SummaryPill({
  label,
  value,
  color,
  subtle,
}: {
  label: string;
  value: number;
  color: string;
  subtle: string;
}) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: subtle }]}
    >
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  feedbackBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '500',
  },
  hero: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  stagingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    alignSelf: 'stretch',
  },
  stagingLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '600',
    flexShrink: 1,
    textShadowColor: 'rgba(10, 13, 25, 0.22)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(248, 249, 255, 0.9)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stagedEventCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    alignSelf: 'stretch',
  },
  stagedEventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  stagedEventSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  stagedEventSummaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stagedEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stagedEventTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stagedEventChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stagedEventChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stagedActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  stagedLoadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stagedActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 249, 255, 0.12)',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
  },
  heroStatValue: {
    color: '#F8F9FD',
    textShadowColor: 'rgba(10, 13, 25, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroStatLabel: {
    color: 'rgba(248, 249, 255, 0.78)',
  },
  toolbar: {
    gap: 12,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    width: '100%',
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 8,
  },
  listContent: {
    paddingBottom: 120,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSku: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(101, 88, 245, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
