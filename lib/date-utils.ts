/**
 * Date utilities for timezone-safe date handling.
 *
 * These utilities use local timezone instead of UTC to prevent off-by-one-day errors
 * for users in timezones ahead of UTC (e.g., JST, AEST).
 */

/**
 * Formats a Date object to YYYY-MM-DD string in the user's local timezone.
 * This replaces the problematic .toISOString().split('T')[0] pattern which uses UTC.
 *
 * @param date - The Date object to format
 * @returns Date string in YYYY-MM-DD format (local timezone)
 *
 * @example
 * // In JST timezone at 2:00 AM on Dec 23
 * formatLocalDate(new Date()) // "2025-12-23" (not "2025-12-22")
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in YYYY-MM-DD format (local timezone).
 * Convenience function for the common case of getting "today".
 *
 * @returns Today's date string in YYYY-MM-DD format (local timezone)
 *
 * @example
 * getTodayLocal() // "2025-12-23" in user's timezone
 */
export function getTodayLocal(): string {
  return formatLocalDate(new Date());
}

/**
 * Parses a YYYY-MM-DD date string into a Date object at local midnight.
 * This is safer than `new Date(dateStr)` which interprets the string as UTC.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object set to local midnight on the specified date
 *
 * @example
 * // In JST timezone (UTC+9)
 * parseLocalDate("2025-12-23") // 2025-12-23 00:00:00 JST (not UTC)
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adds or subtracts days from a date string, returning a new date string.
 * Handles timezone correctly by working with Date objects in local timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New date string in YYYY-MM-DD format (local timezone)
 *
 * @example
 * addDays("2025-12-23", -1) // "2025-12-22"
 * addDays("2025-12-23", 1)  // "2025-12-24"
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}
