/**
 * Date and time formatting utilities
 * Centralized location for all date/time formatting logic
 */

/**
 * Formats a date/time as "X units ago" (e.g., "2 hours ago", "3 days ago")
 * @param value - ISO date string or null
 * @returns Formatted relative time string
 * @example
 * formatTimeAgo('2024-01-01T12:00:00Z') // "3 months ago"
 * formatTimeAgo(null) // "Moments ago"
 */
export function formatTimeAgo(value: string | null): string {
  if (!value) return 'Moments ago';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Moments ago';

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'Just now';

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diffMs < minute) return 'Moments ago';

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (diffMs < week) {
    const days = Math.max(1, Math.round(diffMs / day));
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (diffMs < month) {
    const weeks = Math.max(1, Math.round(diffMs / week));
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  if (diffMs < year) {
    const months = Math.max(1, Math.round(diffMs / month));
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.max(1, Math.round(diffMs / year));
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/**
 * Formats a full timestamp for display
 * @param value - ISO date string or null
 * @returns Localized date/time string
 * @example
 * formatTimestamp('2024-01-01T12:00:00Z') // "1/1/2024, 12:00:00 PM"
 */
export function formatTimestamp(value: string | null): string {
  if (!value) return 'Unknown';

  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
}

/**
 * Formats a Date object as a simple date label
 * @param date - Date object or null
 * @returns Localized date string
 * @example
 * formatDateLabel(new Date()) // "1/1/2024"
 */
export function formatDateLabel(date: Date | null): string {
  if (!date) return 'Select date';

  try {
    return date.toLocaleDateString();
  } catch {
    return 'Select date';
  }
}

/**
 * Formats an event date range (start → end)
 * Shows single date if start and end are the same day
 * @param startISO - Start date ISO string
 * @param endISO - End date ISO string
 * @returns Formatted date range string
 * @example
 * formatEventRange('2024-01-01', '2024-01-03') // "1/1/2024 → 1/3/2024"
 * formatEventRange('2024-01-01', '2024-01-01') // "1/1/2024"
 */
export function formatEventRange(startISO: string, endISO: string): string {
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
}

/**
 * Determines the phase of an event (prep, live, or post)
 * @param startISO - Event start date ISO string
 * @param endISO - Event end date ISO string
 * @returns Event phase
 */
export function getEventPhase(startISO: string, endISO: string): 'prep' | 'live' | 'post' {
  const now = Date.now();
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();

  if (now >= start && now <= end) return 'live';
  if (now < start) return 'prep';
  return 'post';
}

/**
 * Checks if an event is in the future
 * @param startISO - Event start date ISO string
 * @returns True if event hasn't started yet
 */
export function isFutureEvent(startISO: string): boolean {
  const now = Date.now();
  return new Date(startISO).getTime() > now;
}

/**
 * Sorts events by start date (ascending)
 * @param events - Array of events with startDateISO property
 * @returns Sorted array
 */
export function sortEventsByDate<T extends { startDateISO: string }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime()
  );
}

/**
 * Gets the number of days between two dates
 * @param startISO - Start date ISO string
 * @param endISO - End date ISO string
 * @returns Number of days between dates
 */
export function getDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const diffMs = Math.abs(end - start);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Formats a date for use in date inputs (YYYY-MM-DD)
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}