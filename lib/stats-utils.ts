/**
 * Shared utilities for stats calculation
 */

import { formatLocalDate, parseLocalDate, addDays } from '@/lib/date-utils';

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

export interface StreakHabit {
  created_at: string; // YYYY-MM-DD
  scheduled_days: number[] | null;
  frozen_streak: number | null;
  streak_frozen_at: string | null; // YYYY-MM-DD
}

/**
 * Current streak: frozen streak (from before the last schedule change) plus the streak since then.
 * Walks back as far as the base date, so long streaks are not cut off.
 */
export function currentStreak(
  habit: StreakHabit,
  completions: { date: string; completed: boolean }[],
  holidays: Set<string>,
  dayOffs: Set<string>,
  todayStr: string
): number {
  const baseDate = habit.streak_frozen_at || habit.created_at;
  const workingDays = getScheduledWorkingDays(
    parseLocalDate(baseDate),
    parseLocalDate(todayStr),
    habit.scheduled_days,
    holidays,
    dayOffs
  );
  // The freeze date is already counted in frozen_streak
  const workingDaysForStreak = habit.streak_frozen_at
    ? workingDays.filter(d => d > habit.streak_frozen_at!)
    : workingDays;
  return (habit.frozen_streak || 0) + calculateStreak(completions, workingDaysForStreak, baseDate, todayStr);
}

export interface Tally {
  done: number;
  scheduled: number;
}

export interface StatsDay {
  date: string;
  value: number;
  completed: boolean;
  scheduled: boolean;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  scheduledToday: boolean;
  totalCompletions: number;
  totalValue: number;
  range: Tally;
  prevRange: Tally;
  byWeekday: Tally[]; // index 0 = Mon ... 4 = Fri
  days: StatsDay[]; // every weekday in the range since the habit was created
}

/**
 * All stats for one habit over [from, today], plus the same-length period before it.
 * Today only counts towards rates once it is completed, so a pending day is never a miss.
 */
export function computeHabitStats(
  habit: StreakHabit,
  completions: { date: string; value: number; completed: boolean }[],
  holidays: Set<string>,
  dayOffs: Set<string>,
  from: string,
  todayStr: string
): HabitStats {
  const byDate = new Map(completions.map(c => [c.date, c]));
  const isDone = (d: string) => !!byDate.get(d)?.completed;

  // shortcut: past days are judged against the current schedule (old schedules aren't stored),
  // so best streak can undercount before a schedule change; it never drops below the current streak.
  const scheduledDays = getScheduledWorkingDays(
    parseLocalDate(habit.created_at),
    parseLocalDate(todayStr),
    habit.scheduled_days,
    holidays,
    dayOffs
  );
  const scheduledSet = new Set(scheduledDays);

  const streak = currentStreak(habit, completions, holidays, dayOffs, todayStr);
  let bestStreak = streak;
  let run = 0;
  for (const d of scheduledDays) {
    if (isDone(d)) bestStreak = Math.max(bestStreak, ++run);
    else if (d !== todayStr) run = 0;
  }

  const prevFrom = addDays(from, -(daysBetween(from, todayStr) + 1));
  const prevTo = addDays(from, -1);
  const range: Tally = { done: 0, scheduled: 0 };
  const prevRange: Tally = { done: 0, scheduled: 0 };
  const byWeekday: Tally[] = Array.from({ length: 5 }, () => ({ done: 0, scheduled: 0 }));
  for (const d of scheduledDays) {
    if (d === todayStr && !isDone(d)) continue;
    const done = isDone(d) ? 1 : 0;
    if (d >= from) {
      range.scheduled++;
      range.done += done;
      const wd = byWeekday[parseLocalDate(d).getDay() - 1];
      wd.scheduled++;
      wd.done += done;
    } else if (d >= prevFrom && d <= prevTo) {
      prevRange.scheduled++;
      prevRange.done += done;
    }
  }

  const days: StatsDay[] = [];
  const start = from > habit.created_at ? from : habit.created_at;
  for (let d = start; d <= todayStr; d = addDays(d, 1)) {
    const dow = parseLocalDate(d).getDay();
    if (dow === 0 || dow === 6) continue;
    const c = byDate.get(d);
    days.push({ date: d, value: c?.value ?? 0, completed: !!c?.completed, scheduled: scheduledSet.has(d) });
  }

  let totalCompletions = 0;
  let totalValue = 0;
  for (const c of completions) {
    if (c.completed) totalCompletions++;
    totalValue += c.value;
  }

  return {
    currentStreak: streak,
    bestStreak,
    completedToday: isDone(todayStr),
    scheduledToday: scheduledSet.has(todayStr),
    totalCompletions,
    totalValue,
    range,
    prevRange,
    byWeekday,
    days,
  };
}

/** Whole days from a to b (YYYY-MM-DD), DST-safe. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000);
}

function ymd(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m - 1, d];
}
