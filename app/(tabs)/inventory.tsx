import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import type { InventoryItem } from '@/types/inventory';
import { buildInventoryCsv, parseInventoryCsv } from '@/utils/inventoryCsv';
import { createInventoryItem, updateInventoryItem } from '@/lib/inventory';

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

type InventoryListItemProps = {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
};

const FREE_PLAN_ITEM_LIMIT = 5;
const PAUSED_PLAN_ITEM_LIMIT = 3;

export default function InventoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession } = useSession();

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

  const userId = user?.id ?? null;
  const { items, loading, error, refresh } = useInventory(userId);

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

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      void refresh();
      return undefined;
    }, [refresh, userId]),
  );

  const planTier = user?.subscription?.plan?.tier ?? 'free';
  const planPaused = Boolean(user?.subscription?.pausedAt);
  const planItemLimit = useMemo(() => {
    if (planPaused) return PAUSED_PLAN_ITEM_LIMIT;
    if (planTier === 'free') return FREE_PLAN_ITEM_LIMIT;
    const fromPlan = user?.subscription?.plan?.maxInventoryItems;
    return typeof fromPlan === 'number' && fromPlan > 0 ? fromPlan : null;
  }, [planPaused, planTier, user?.subscription?.plan?.maxInventoryItems]);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.quantity > 0 && item.quantity <= Math.max(item.lowStockThreshold, 0)),
    [items],
  );

  const outOfStockItems = useMemo(() => items.filter((item) => item.quantity <= 0), [items]);

  const stats = useMemo<SummaryStat[]>(() => {
    const total = items.length;

    return [
      {
        label: 'Total items',
        value: planItemLimit != null ? `${total}/${planItemLimit}` : total,
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
  }, [items, lowStockItems.length, outOfStockItems.length, planItemLimit, theme.colors.error, theme.colors.primary, theme.colors.warning]);

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

  const applyInventoryRows = useCallback(
    async (rows: ReturnType<typeof parseInventoryCsv>) => {
      if (!userId || !rows.length) return;

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
            await updateInventoryItem({ userId, itemId: existing.id, input });
            updated += 1;
          } else {
            if (planItemLimit != null && items.length + created >= planItemLimit) {
              skipped.push(`${row.name} (plan limit reached)`);
              continue;
            }
            await createInventoryItem({ userId, input });
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
    [items, currentSession?.eventId, planItemLimit, refresh, userId],
  );

  const handleImportCsv = useCallback(async () => {
    if (!userId) {
      setFeedback({ type: 'error', message: 'Sign in to import inventory.' });
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
  }, [applyInventoryRows, userId]);

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
              refreshing={loading}
              onRefresh={() => refresh()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          )}
        />
      </View>

      <Modal visible={importOptionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
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
        </View>
      </Modal>

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
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
