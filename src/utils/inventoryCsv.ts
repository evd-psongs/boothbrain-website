import type { InventoryItem } from '@/types/inventory';

export type InventoryCsvRow = {
  name: string;
  priceCents: number;
  sku: string | null;
  quantity: number;
  lowStockThreshold: number;
};

const escape = (value: string | number | null | undefined) => {
  const str = value === null || value === undefined ? '' : String(value);
  const normalized = str.replace(/"/g, '""');
  return `"${normalized}"`;
};

const parseLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
};

export function buildInventoryCsv(items: InventoryItem[]) {
  const header = ['Name', 'SKU', 'Price (USD)', 'Quantity', 'Low Stock Threshold'];
  const rows = items.map((item) => [
    item.name,
    item.sku ?? '',
    (item.priceCents / 100).toFixed(2),
    item.quantity,
    item.lowStockThreshold,
  ]);

  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

export function parseInventoryCsv(csv: string): InventoryCsvRow[] {
  const normalized = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length);
  if (!lines.length) return [];

  const headers = parseLine(lines[0].replace(/^\ufeff/, '')).map((cell) => cell.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const priceIndex = headers.findIndex((cell) => cell.startsWith('price'));

  if (nameIndex === -1 || priceIndex === -1) {
    throw new Error('CSV must include Name and Price columns.');
  }

  const skuIndex = headers.indexOf('sku');
  const quantityIndex = headers.findIndex((cell) => cell.startsWith('quantity'));
  const lowStockIndex = headers.findIndex((cell) => cell.includes('low'));

  const rows: InventoryCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const raw = parseLine(lines[i] ?? '');
    const name = (raw[nameIndex] ?? '').trim();
    if (!name) continue;

    const priceCell = (raw[priceIndex] ?? '').trim();
    const priceValue = Number.parseFloat(priceCell);
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      throw new Error(`Row ${i + 1}: price must be greater than zero.`);
    }

    const quantityCell = quantityIndex >= 0 ? (raw[quantityIndex] ?? '').trim() : '';
    const thresholdCell = lowStockIndex >= 0 ? (raw[lowStockIndex] ?? '').trim() : '';

    rows.push({
      name,
      sku: skuIndex >= 0 ? (raw[skuIndex] ?? '').trim() || null : null,
      priceCents: Math.round(priceValue * 100),
      quantity: Number.parseInt(quantityCell, 10) || 0,
      lowStockThreshold: Number.parseInt(thresholdCell, 10) || 0,
    });
  }

  return rows;
}
