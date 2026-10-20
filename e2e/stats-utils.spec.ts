import { test, expect } from '@playwright/test';
import { computeHabitStats } from '../lib/stats-utils';
import { addDays, parseLocalDate } from '../lib/date-utils';

// Pure unit tests for the stats calculation (no browser needed)

const TODAY = '2026-10-20'; // Tuesday
const none = new Set<string>();

const habit = (overrides: Partial<Parameters<typeof computeHabitStats>[0]> = {}) => ({
  created_at: '2026-10-05', // Monday
  scheduled_days: null,
  frozen_streak: 0,
  streak_frozen_at: null,
  ...overrides,
});

function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = parseLocalDate(d).getDay();
    if (dow !== 0 && dow !== 6) out.push(d);
  }
  return out;
}

const done = (dates: string[]) => dates.map(date => ({ date, value: 1, completed: true }));

test.describe('computeHabitStats', () => {
  test('streak is not capped at 90 days', () => {
    const days = weekdays('2026-01-05', TODAY);
    const s = computeHabitStats(habit({ created_at: '2026-01-05' }), done(days), none, none, '2026-09-21', TODAY);
    expect(days.length).toBeGreaterThan(64);
    expect(s.currentStreak).toBe(days.length);
    expect(s.bestStreak).toBe(days.length);
  });

  test('pending today neither breaks the streak nor counts as a miss', () => {
    const s = computeHabitStats(habit(), done(weekdays('2026-10-05', '2026-10-19')), none, none, '2026-10-05', TODAY);
    expect(s.currentStreak).toBe(11);
    expect(s.scheduledToday).toBe(true);
    expect(s.completedToday).toBe(false);
    expect(s.range).toEqual({ done: 11, scheduled: 11 });
  });

  test('holidays and day-offs are skipped, not missed', () => {
    const holidays = new Set(['2026-10-12']);
    const dayOffs = new Set(['2026-10-14']);
    const dates = weekdays('2026-10-05', TODAY).filter(d => !holidays.has(d) && !dayOffs.has(d));
    const s = computeHabitStats(habit(), done(dates), holidays, dayOffs, '2026-10-05', TODAY);
    expect(s.currentStreak).toBe(dates.length);
    expect(s.range.scheduled).toBe(dates.length);
    expect(s.days.find(d => d.date === '2026-10-12')?.scheduled).toBe(false);
  });

  test('best streak survives a miss; current streak restarts', () => {
    const dates = weekdays('2026-10-05', TODAY).filter(d => d !== '2026-10-15');
    const s = computeHabitStats(habit(), done(dates), none, none, '2026-10-05', TODAY);
    expect(s.bestStreak).toBe(8); // Oct 5–14
    expect(s.currentStreak).toBe(3); // Fri Oct 16, Mon 19, Tue 20
    expect(s.range).toEqual({ done: 11, scheduled: 12 });
    expect(s.byWeekday[3]).toEqual({ done: 1, scheduled: 2 }); // Thursdays
  });

  test('frozen streak is added and the freeze date is not double-counted', () => {
    const s = computeHabitStats(
      habit({ frozen_streak: 5, streak_frozen_at: '2026-10-16', scheduled_days: [1, 3, 5] }),
      done(['2026-10-16', '2026-10-19']),
      none, none, '2026-10-05', TODAY
    );
    expect(s.currentStreak).toBe(6); // 5 frozen + Mon Oct 19 (Tue isn't scheduled)
    expect(s.scheduledToday).toBe(false);
  });

  test('previous period has the same length as the range', () => {
    const s = computeHabitStats(habit({ created_at: '2026-09-01' }), done(weekdays('2026-09-01', TODAY)), none, none, '2026-10-14', TODAY);
    expect(s.range.scheduled).toBe(5); // Oct 14–20 weekdays
    expect(s.prevRange.scheduled).toBe(5); // Oct 7–13 weekdays
  });
});
