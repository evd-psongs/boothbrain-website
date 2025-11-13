import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Share } from 'react-native';
import { parseInventoryCsv, buildInventoryCsv, type InventoryCsvRow } from '@/utils/inventoryCsv';
import { createInventoryItem, updateInventoryItem } from '@/lib/inventory';
import type { InventoryItem } from '@/types/inventory';

type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
};

type CsvImportExportOptions = {
  userId: string | null;
  ownerUserId: string | null;
  items: InventoryItem[];
  currentSessionId?: string | null;
  planItemLimit?: number | null;
  totalTrackedCount: number;
  onRefresh: () => Promise<void>;
  onFeedback: (type: 'success' | 'error' | 'info', message: string) => void;
};

export function useCsvImportExport({
  userId,
  ownerUserId,
  items,
  currentSessionId,
  planItemLimit,
  totalTrackedCount,
  onRefresh,
  onFeedback,
}: CsvImportExportOptions) {
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

  const applyInventoryRows = useCallback(
    async (rows: InventoryCsvRow[]) => {
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
          sessionId: currentSessionId ?? null,
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

      await onRefresh();

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

      onFeedback(skipped.length ? 'info' : 'success', message);
    },
    [items, currentSessionId, planItemLimit, onRefresh, totalTrackedCount, ownerUserId, onFeedback],
  );

  const handleImportCsv = useCallback(async () => {
    if (!userId || !ownerUserId) {
      onFeedback('error', 'Session owner not available yet.');
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
        onFeedback('info', 'No inventory rows were found in that file.');
        return;
      }

      await applyInventoryRows(rows);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Failed to import inventory.';
      onFeedback('error', message);
    } finally {
      setIsProcessingImport(false);
    }
  }, [applyInventoryRows, userId, ownerUserId, onFeedback]);

  const handleExportCsv = useCallback(
    async (filteredItems: InventoryItem[]) => {
      if (!filteredItems.length) {
        onFeedback('info', 'No items match the current filters to export.');
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
        onFeedback('success', `Exported ${filteredItems.length} items.`);
      } catch (exportError) {
        const message = exportError instanceof Error ? exportError.message : 'Failed to export inventory.';
        onFeedback('error', message);
      } finally {
        setIsExporting(false);
      }
    },
    [onFeedback],
  );

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
      onFeedback('error', 'Sign in to import inventory.');
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
        onFeedback('info', 'No inventory rows were found in that sheet.');
        return;
      }
      setGoogleSheetUrl('');
      await applyInventoryRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import from Google Sheets.';
      setImportError(message);
      onFeedback('error', message);
    } finally {
      setIsProcessingImport(false);
    }
  }, [userId, googleSheetUrl, normalizeGoogleSheetUrl, applyInventoryRows, onFeedback]);

  return {
    isProcessingImport,
    isExporting,
    lastImportSummary,
    importError,
    googleSheetUrl,
    setGoogleSheetUrl,
    setImportError,
    setLastImportSummary,
    handleImportCsv,
    handleExportCsv,
    handleImportFromGoogleSheets,
  };
}