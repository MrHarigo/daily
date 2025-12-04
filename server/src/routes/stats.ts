import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const statsRouter = Router();

statsRouter.use(requireAuth);

interface Habit {
  id: string;
  name: string;
  type: 'boolean' | 'count' | 'time';
  target_value: number | null;
  created_at: string;
}

interface HabitCompletion {
  date: string;
  completed: boolean;
}

interface Holiday {
  date: string;
}

interface DayOff {
  date: string;
}

// Helper to get all non-working dates as a Set
async function getNonWorkingDates(startDate: string, endDate: string): Promise<Set<string>> {
  const nonWorkingDates = new Set<string>();

  // Get holidays
  const holidays = await query<Holiday>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date FROM holidays WHERE date >= $1 AND date <= $2`,
    [startDate, endDate]
  );
  holidays.forEach(h => nonWorkingDates.add(h.date));

  // Get day-offs
  const dayOffs = await query<DayOff>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date FROM day_offs WHERE date >= $1 AND date <= $2`,
    [startDate, endDate]
  );
  dayOffs.forEach(d => nonWorkingDates.add(d.date));

  // Add weekends
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nonWorkingDates.add(d.toISOString().split('T')[0]);
    }
  }

  return nonWorkingDates;
}

// Calculate current streak for a habit
async function calculateStreak(habitId: string, habitCreatedAt: string): Promise<number> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Get non-working dates from habit creation to today
  const nonWorkingDates = await getNonWorkingDates(habitCreatedAt.split('T')[0], todayStr);

  // Get all completions for this habit, ordered by date descending
  const completions = await query<HabitCompletion>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date, completed FROM habit_completions 
     WHERE habit_id = $1 AND completed = TRUE
     ORDER BY date DESC`,
    [habitId]
  );

  const completedDates = new Set(completions.map(c => c.date));

  let streak = 0;
  let checkDate = new Date(today);

  // Start from today and go backwards
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];

    // Stop if we've gone before habit creation
    if (dateStr < habitCreatedAt.split('T')[0]) {
      break;
    }

    // Skip non-working days (they don't break the streak)
    if (nonWorkingDates.has(dateStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    // Check if this working day was completed
    if (completedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If today is not completed yet, don't break streak, just skip
      if (dateStr === todayStr) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      // Otherwise, streak is broken
      break;
    }
  }

  return streak;
}

// Calculate longest streak for a habit
async function calculateLongestStreak(habitId: string, habitCreatedAt: string): Promise<number> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const nonWorkingDates = await getNonWorkingDates(habitCreatedAt.split('T')[0], todayStr);

  const completions = await query<HabitCompletion>(
    `SELECT to_char(date, 'YYYY-MM-DD') as date, completed FROM habit_completions 
     WHERE habit_id = $1 AND completed = TRUE
     ORDER BY date ASC`,
    [habitId]
  );

  const completedDates = new Set(completions.map(c => c.date));

  let longestStreak = 0;
  let currentStreak = 0;
  let checkDate = new Date(habitCreatedAt.split('T')[0]);

  while (checkDate <= today) {
    const dateStr = checkDate.toISOString().split('T')[0];

    // Skip non-working days
    if (nonWorkingDates.has(dateStr)) {
      checkDate.setDate(checkDate.getDate() + 1);
      continue;
    }

    if (completedDates.has(dateStr)) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }

  return longestStreak;
}

// Get overall stats
statsRouter.get('/overview', async (req, res) => {
  try {
    const habits = await query<Habit>(
      `SELECT id, name, type, target_value, created_at
       FROM habits WHERE archived_at IS NULL AND paused_at IS NULL`
    );

    // Get ALL completions for each habit (not just last 30 days)
    const allCompletions = await query<{ habit_id: string; completed: boolean; value: number }>(
      `SELECT habit_id, completed, value FROM habit_completions`
    );

    // Calculate stats per habit
    const habitStats = await Promise.all(
      habits.map(async (habit) => {
        const habitCompletions = allCompletions.filter(c => c.habit_id === habit.id);
        
        // Handle both Date objects and strings from PostgreSQL
        const createdAtStr = habit.created_at instanceof Date 
          ? habit.created_at.toISOString() 
          : String(habit.created_at);

        const currentStreak = await calculateStreak(habit.id, createdAtStr);

        // Calculate totals based on habit type
        let totalValue = 0;
        if (habit.type === 'boolean') {
          // Count completed days
          totalValue = habitCompletions.filter(c => c.completed).length;
        } else {
          // Sum of values (time in seconds or count)
          totalValue = habitCompletions.reduce((sum, c) => sum + (c.value || 0), 0);
        }

        return {
          id: habit.id,
          name: habit.name,
          type: habit.type,
          currentStreak,
          totalValue,
        };
      })
    );

    // Overall stats
    const bestCurrentStreak = Math.max(0, ...habitStats.map(h => h.currentStreak));
    const totalCompletions = allCompletions.filter(c => c.completed).length;

    res.json({
      overall: {
        bestCurrentStreak,
        totalCompletions,
        totalHabits: habits.length,
      },
      habits: habitStats,
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

// Get stats for a specific habit
statsRouter.get('/habit/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await queryOne<Habit>(
      'SELECT id, name, type, target_value, created_at FROM habits WHERE id = $1',
      [id]
    );

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Handle both Date objects and strings from PostgreSQL
    const createdAtStr = habit.created_at instanceof Date 
      ? habit.created_at.toISOString() 
      : String(habit.created_at);
    const createdAtDate = createdAtStr.split('T')[0];

    const currentStreak = await calculateStreak(id, createdAtStr);
    const longestStreak = await calculateLongestStreak(id, createdAtStr);

    // Get all completions
    const completions = await query<{ date: string; value: number; completed: boolean }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, value, completed FROM habit_completions
       WHERE habit_id = $1 ORDER BY date DESC`,
      [id]
    );

    // Calculate total working days since habit creation
    const today = new Date().toISOString().split('T')[0];
    const nonWorkingDates = await getNonWorkingDates(createdAtDate, today);
    
    let totalWorkingDays = 0;
    for (
      let d = new Date(createdAtDate); 
      d <= new Date(today); 
      d.setDate(d.getDate() + 1)
    ) {
      if (!nonWorkingDates.has(d.toISOString().split('T')[0])) {
        totalWorkingDays++;
      }
    }

    const completedDays = completions.filter(c => c.completed).length;
    const completionRate = totalWorkingDays > 0 
      ? Math.round((completedDays / totalWorkingDays) * 100) 
      : 0;

    // For time habits, calculate total time
    let totalTime = 0;
    if (habit.type === 'time') {
      totalTime = completions.reduce((sum, c) => sum + c.value, 0);
    }

    // For count habits, calculate total count
    let totalCount = 0;
    if (habit.type === 'count') {
      totalCount = completions.reduce((sum, c) => sum + c.value, 0);
    }

    res.json({
      habit,
      currentStreak,
      longestStreak,
      completionRate,
      totalWorkingDays,
      completedDays,
      totalTime, // in seconds
      totalCount,
      recentCompletions: completions.slice(0, 30),
    });
  } catch (error) {
    console.error('Get habit stats error:', error);
    res.status(500).json({ error: 'Failed to get habit stats' });
  }
});

// Get completion calendar data (for heatmap)
statsRouter.get('/calendar', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const habits = await query<{ id: string }>(
      'SELECT id FROM habits WHERE archived_at IS NULL'
    );

    const completions = await query<{ date: string; completed: boolean; habit_id: string }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, completed, habit_id FROM habit_completions
       WHERE date >= $1 AND date <= $2`,
      [start_date, end_date]
    );

    const nonWorkingDates = await getNonWorkingDates(
      start_date as string, 
      end_date as string
    );

    // Group by date
    const calendarData: Record<string, {
      totalHabits: number;
      completedHabits: number;
      isWorkingDay: boolean;
    }> = {};

    for (
      let d = new Date(start_date as string); 
      d <= new Date(end_date as string); 
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split('T')[0];
      const dayCompletions = completions.filter(c => c.date === dateStr);
      
      calendarData[dateStr] = {
        totalHabits: habits.length,
        completedHabits: dayCompletions.filter(c => c.completed).length,
        isWorkingDay: !nonWorkingDates.has(dateStr),
      };
    }

    res.json(calendarData);
  } catch (error) {
    console.error('Get calendar stats error:', error);
    res.status(500).json({ error: 'Failed to get calendar stats' });
  }
});

