/**
 * Shared utilities for stats calculation
 */

// In-memory cache for working days calculation
// Key format: `${todayStr}-${userId}`
const workingDaysCache = new Map<string, {
  workingDays: string[];
  holidays: Set<string>;
  dayOffs: Set<string>;
}>();

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
  const dateStr = date.toISOString().split('T')[0];
  return !holidays.has(dateStr) && !dayOffs.has(dateStr);
}

/**
 * Gets working days for the last 90 days with caching
 * Caches the result per day per user to avoid redundant calculations
 * @param userId The user ID for day-offs lookup
 * @param queryFn Function to execute database queries
 * @returns Object containing workingDays array, holidays, dayOffs sets, today date, and todayStr
 */
export async function getWorkingDaysWithCache(
  userId: string,
  queryFn: <T>(sql: string, params?: any[]) => Promise<T[]>
): Promise<{
  workingDays: string[];
  holidays: Set<string>;
  dayOffs: Set<string>;
  today: Date;
  todayStr: string;
}> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const cacheKey = `${todayStr}-${userId}`;

  // Check cache
  const cached = workingDaysCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      today,
      todayStr,
    };
  }

  // Fetch holidays and day-offs
  const holidaysData = await queryFn<{ date: string }>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays`
  );
  const dayOffsData = await queryFn<{ date: string }>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE user_id = $1`,
    [userId]
  );

  const holidays = new Set(holidaysData.map(h => h.date));
  const dayOffs = new Set(dayOffsData.map(d => d.date));

  // Calculate working days for last 90 days
  const workingDays: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (isWorkingDay(d, holidays, dayOffs)) {
      workingDays.push(d.toISOString().split('T')[0]);
    }
  }

  // Cache the result
  const result = { workingDays, holidays, dayOffs };
  workingDaysCache.set(cacheKey, result);

  // Clean up old cache entries (keep only today's entries)
  for (const key of workingDaysCache.keys()) {
    if (!key.startsWith(todayStr)) {
      workingDaysCache.delete(key);
    }
  }

  return {
    ...result,
    today,
    todayStr,
  };
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
