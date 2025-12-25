/**
 * Shared utilities for stats calculation
 */

import { formatLocalDate } from '@/lib/date-utils';

/**
 * Determines if a given date is a working day
 * @param date The date to check
 * @param holidays Set of holiday dates in YYYY-MM-DD format
 * @param dayOffs Set of day-off dates in YYYY-MM-DD format
 * @returns true if the date is a working day (weekday, not a holiday or day-off)
 */
export function isWorkingDay(
  date: Date,
  holidays: Set<string>,
  dayOffs: Set<string>
): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const dateStr = formatLocalDate(date);
  return !holidays.has(dateStr) && !dayOffs.has(dateStr);
}

/**
 * Determines if a habit is scheduled for a given date
 * @param date The date to check
 * @param scheduledDays Array of weekday numbers (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri) or null for all weekdays
 * @returns true if the habit is scheduled for this day of the week
 */
export function isScheduledDay(date: Date, scheduledDays: number[] | null): boolean {
  // null = weekdays default (Mon-Fri)
  if (scheduledDays === null) {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  // Custom schedule
  const dayOfWeek = date.getDay();
  return scheduledDays.includes(dayOfWeek);
}

/**
 * Generates a list of scheduled working days (intersection of scheduled days and working days)
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @param scheduledDays Array of weekday numbers (1=Mon, 5=Fri) or null for all weekdays
 * @param holidays Set of holiday dates in YYYY-MM-DD format
 * @param dayOffs Set of day-off dates in YYYY-MM-DD format
 * @returns Array of date strings in YYYY-MM-DD format that are both scheduled and working days
 */
export function getScheduledWorkingDays(
  startDate: Date,
  endDate: Date,
  scheduledDays: number[] | null,
  holidays: Set<string>,
  dayOffs: Set<string>
): string[] {
  const result: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    // Must be BOTH scheduled AND a working day
    if (isScheduledDay(current, scheduledDays) && isWorkingDay(current, holidays, dayOffs)) {
      result.push(formatLocalDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Calculates the current streak for a habit
 * @param completions Array of completion records with date and completed status
 * @param workingDays Array of working day dates in YYYY-MM-DD format
 * @param habitCreatedAt The date the habit was created in YYYY-MM-DD format
 * @param todayStr Today's date in YYYY-MM-DD format
 * @returns The current streak count
 */
export function calculateStreak(
  completions: { date: string; completed: boolean }[],
  workingDays: string[],
  habitCreatedAt: string,
  todayStr: string
): number {
  // Guard against empty working days
  if (workingDays.length === 0) return 0;

  let streak = 0;
  const completionMap = new Map(completions.map(c => [c.date, c.completed]));

  // Start from today and work backwards
  let startIdx = workingDays.length - 1;

  // If today is a working day but not completed, skip it and start from yesterday
  // This way we show the "active" streak that can still be extended
  const lastWorkingDay = workingDays[startIdx];
  if (lastWorkingDay === todayStr && !completionMap.get(todayStr)) {
    startIdx--;
    // If no previous days exist, streak is 0
    if (startIdx < 0) return 0;
  }

  for (let i = startIdx; i >= 0; i--) {
    const day = workingDays[i];
    if (day < habitCreatedAt) break;
    if (completionMap.get(day)) streak++;
    else break;
  }
  return streak;
}
