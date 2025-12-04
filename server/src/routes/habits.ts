import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const habitsRouter = Router();

// Apply auth middleware to all routes
habitsRouter.use(requireAuth);

interface Habit {
  id: string;
  name: string;
  type: 'boolean' | 'count' | 'time';
  target_value: number | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  completed: boolean;
}

interface ActiveTimer {
  habit_id: string;
  date: string;
  started_at: string;
  accumulated_seconds: number;
  is_running: boolean;
}

// Get all active habits (not archived)
habitsRouter.get('/', async (req, res) => {
  try {
    const habits = await query<Habit>(
      `SELECT id, name, type, target_value, sort_order, 
              to_char(created_at, 'YYYY-MM-DD') as created_at,
              to_char(paused_at, 'YYYY-MM-DD"T"HH24:MI:SS') as paused_at
       FROM habits
       WHERE archived_at IS NULL
       ORDER BY sort_order, created_at`
    );
    res.json(habits);
  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({ error: 'Failed to get habits' });
  }
});

// Get archived habits
habitsRouter.get('/archived', async (req, res) => {
  try {
    const habits = await query<Habit>(
      `SELECT id, name, type, target_value, sort_order,
              to_char(created_at, 'YYYY-MM-DD') as created_at,
              to_char(archived_at, 'YYYY-MM-DD') as archived_at
       FROM habits
       WHERE archived_at IS NOT NULL
       ORDER BY archived_at DESC`
    );
    res.json(habits);
  } catch (error) {
    console.error('Get archived habits error:', error);
    res.status(500).json({ error: 'Failed to get archived habits' });
  }
});

// Create a new habit
habitsRouter.post('/', async (req, res) => {
  try {
    const { name, type = 'boolean', target_value } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Get max sort_order
    const maxOrder = await queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM habits WHERE archived_at IS NULL'
    );

    const habit = await queryOne<Habit>(
      `INSERT INTO habits (name, type, target_value, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, type, target_value, sort_order, to_char(created_at, 'YYYY-MM-DD') as created_at`,
      [name, type, target_value, (maxOrder?.max || 0) + 1]
    );

    res.json(habit);
  } catch (error) {
    console.error('Create habit error:', error);
    res.status(500).json({ error: 'Failed to create habit' });
  }
});

// Update a habit
habitsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, target_value, sort_order } = req.body;

    const habit = await queryOne<Habit>(
      `UPDATE habits
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           target_value = COALESCE($3, target_value),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND archived_at IS NULL
       RETURNING id, name, type, target_value, sort_order, created_at`,
      [name, type, target_value, sort_order, id]
    );

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    res.json(habit);
  } catch (error) {
    console.error('Update habit error:', error);
    res.status(500).json({ error: 'Failed to update habit' });
  }
});

// Archive a habit (soft delete)
habitsRouter.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryOne<Habit>(
      `UPDATE habits SET archived_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Archive habit error:', error);
    res.status(500).json({ error: 'Failed to archive habit' });
  }
});

// Permanently delete a habit
habitsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete completions first (foreign key constraint)
    await query('DELETE FROM habit_completions WHERE habit_id = $1', [id]);
    
    // Delete active timers
    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);

    // Delete the habit
    const result = await queryOne<Habit>(
      `DELETE FROM habits WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
});

// Unarchive a habit
habitsRouter.post('/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await queryOne<Habit>(
      `UPDATE habits SET archived_at = NULL 
       WHERE id = $1 
       RETURNING id, name, type, target_value, sort_order, 
                 to_char(created_at, 'YYYY-MM-DD') as created_at`,
      [id]
    );

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    res.json(habit);
  } catch (error) {
    console.error('Unarchive habit error:', error);
    res.status(500).json({ error: 'Failed to unarchive habit' });
  }
});

// Pause a habit (freezes streak)
habitsRouter.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await queryOne<Habit>(
      `UPDATE habits SET paused_at = NOW() 
       WHERE id = $1 AND archived_at IS NULL AND paused_at IS NULL
       RETURNING id, name, type, target_value, sort_order,
                 to_char(created_at, 'YYYY-MM-DD') as created_at,
                 to_char(paused_at, 'YYYY-MM-DD"T"HH24:MI:SS') as paused_at`,
      [id]
    );

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found or already paused' });
    }

    res.json(habit);
  } catch (error) {
    console.error('Pause habit error:', error);
    res.status(500).json({ error: 'Failed to pause habit' });
  }
});

// Unpause a habit
habitsRouter.post('/:id/unpause', async (req, res) => {
  try {
    const { id } = req.params;

    const habit = await queryOne<Habit>(
      `UPDATE habits SET paused_at = NULL 
       WHERE id = $1 AND archived_at IS NULL AND paused_at IS NOT NULL
       RETURNING id, name, type, target_value, sort_order,
                 to_char(created_at, 'YYYY-MM-DD') as created_at,
                 paused_at`,
      [id]
    );

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found or not paused' });
    }

    res.json(habit);
  } catch (error) {
    console.error('Unpause habit error:', error);
    res.status(500).json({ error: 'Failed to unpause habit' });
  }
});

// Reorder habits
habitsRouter.post('/reorder', async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, sort_order }

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    for (const item of order) {
      await query(
        'UPDATE habits SET sort_order = $1 WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder habits error:', error);
    res.status(500).json({ error: 'Failed to reorder habits' });
  }
});

// Get completions for a date range
habitsRouter.get('/completions', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const completions = await query<HabitCompletion>(
      `SELECT id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed
       FROM habit_completions
       WHERE date >= $1 AND date <= $2`,
      [start_date, end_date]
    );

    res.json(completions);
  } catch (error) {
    console.error('Get completions error:', error);
    res.status(500).json({ error: 'Failed to get completions' });
  }
});

// Get completion for a specific habit and date
habitsRouter.get('/:id/completion/:date', async (req, res) => {
  try {
    const { id, date } = req.params;

    const completion = await queryOne<HabitCompletion>(
      `SELECT id, habit_id, date, value, completed
       FROM habit_completions
       WHERE habit_id = $1 AND date = $2`,
      [id, date]
    );

    res.json(completion || { habit_id: id, date, value: 0, completed: false });
  } catch (error) {
    console.error('Get completion error:', error);
    res.status(500).json({ error: 'Failed to get completion' });
  }
});

// Update/create completion for a habit
habitsRouter.post('/:id/completion', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, value, completed } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const completion = await queryOne<HabitCompletion>(
      `INSERT INTO habit_completions (habit_id, date, value, completed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (habit_id, date)
       DO UPDATE SET value = $3, completed = $4
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, date, value ?? 0, completed ?? false]
    );

    res.json(completion);
  } catch (error) {
    console.error('Update completion error:', error);
    res.status(500).json({ error: 'Failed to update completion' });
  }
});

// Increment count for a habit (for count type)
habitsRouter.post('/:id/increment', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, delta = 1 } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get habit to check target
    const habit = await queryOne<Habit>(
      'SELECT target_value FROM habits WHERE id = $1',
      [id]
    );

    const completion = await queryOne<HabitCompletion>(
      `INSERT INTO habit_completions (habit_id, date, value, completed)
       VALUES ($1, $2, GREATEST(0, $3), $3 >= $4)
       ON CONFLICT (habit_id, date)
       DO UPDATE SET 
         value = GREATEST(0, habit_completions.value + $3),
         completed = GREATEST(0, habit_completions.value + $3) >= $4
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, date, delta, habit?.target_value || 1]
    );

    res.json(completion);
  } catch (error) {
    console.error('Increment error:', error);
    res.status(500).json({ error: 'Failed to increment' });
  }
});

// Timer endpoints for time-based habits

// Get active timer for a habit
habitsRouter.get('/:id/timer', async (req, res) => {
  try {
    const { id } = req.params;

    const timer = await queryOne<ActiveTimer>(
      `SELECT habit_id, date, started_at, accumulated_seconds, is_running
       FROM active_timers
       WHERE habit_id = $1`,
      [id]
    );

    res.json(timer);
  } catch (error) {
    console.error('Get timer error:', error);
    res.status(500).json({ error: 'Failed to get timer' });
  }
});

// Start timer
habitsRouter.post('/:id/timer/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check if timer exists
    const existing = await queryOne<ActiveTimer>(
      'SELECT * FROM active_timers WHERE habit_id = $1',
      [id]
    );

    let timer: ActiveTimer | null;

    if (existing) {
      // Resume existing timer
      timer = await queryOne<ActiveTimer>(
        `UPDATE active_timers
         SET is_running = TRUE, started_at = NOW(), date = $2
         WHERE habit_id = $1
         RETURNING habit_id, date, started_at, accumulated_seconds, is_running`,
        [id, date]
      );
    } else {
      // Check if there's an existing completion for today (to continue from)
      const existingCompletion = await queryOne<{ value: number }>(
        'SELECT value FROM habit_completions WHERE habit_id = $1 AND date = $2',
        [id, date]
      );
      const initialSeconds = existingCompletion?.value || 0;

      // Create new timer with existing completion value
      timer = await queryOne<ActiveTimer>(
        `INSERT INTO active_timers (habit_id, date, started_at, accumulated_seconds, is_running)
         VALUES ($1, $2, NOW(), $3, TRUE)
         RETURNING habit_id, date, started_at, accumulated_seconds, is_running`,
        [id, date, initialSeconds]
      );
    }

    res.json(timer);
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Pause timer
habitsRouter.post('/:id/timer/pause', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current timer state
    const current = await queryOne<ActiveTimer>(
      'SELECT * FROM active_timers WHERE habit_id = $1 AND is_running = TRUE',
      [id]
    );

    if (!current) {
      return res.status(400).json({ error: 'No running timer found' });
    }

    // Calculate elapsed time since started_at
    const elapsed = Math.floor(
      (Date.now() - new Date(current.started_at).getTime()) / 1000
    );

    const timer = await queryOne<ActiveTimer>(
      `UPDATE active_timers
       SET is_running = FALSE, accumulated_seconds = accumulated_seconds + $2
       WHERE habit_id = $1
       RETURNING habit_id, date, started_at, accumulated_seconds, is_running`,
      [id, elapsed]
    );

    res.json(timer);
  } catch (error) {
    console.error('Pause timer error:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// Stop timer and save to completion
habitsRouter.post('/:id/timer/stop', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current timer state
    const timer = await queryOne<ActiveTimer>(
      'SELECT * FROM active_timers WHERE habit_id = $1',
      [id]
    );

    if (!timer) {
      return res.status(400).json({ error: 'No timer found' });
    }

    // Calculate total time
    let totalSeconds = timer.accumulated_seconds;
    if (timer.is_running) {
      const elapsed = Math.floor(
        (Date.now() - new Date(timer.started_at).getTime()) / 1000
      );
      totalSeconds += elapsed;
    }

    // Get habit to check target
    const habit = await queryOne<Habit>(
      'SELECT target_value FROM habits WHERE id = $1',
      [id]
    );

    const targetSeconds = (habit?.target_value || 0) * 60;
    const completed = totalSeconds >= targetSeconds;

    // Save to completion (totalSeconds already includes existing value from when timer started)
    const completion = await queryOne<HabitCompletion>(
      `INSERT INTO habit_completions (habit_id, date, value, completed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (habit_id, date)
       DO UPDATE SET value = $3, completed = $3 >= $5
       RETURNING id, habit_id, to_char(date, 'YYYY-MM-DD') as date, value, completed`,
      [id, timer.date, totalSeconds, completed, targetSeconds]
    );

    // Delete timer
    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);

    res.json({ completion, totalSeconds });
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Reset timer
habitsRouter.post('/:id/timer/reset', async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM active_timers WHERE habit_id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Reset timer error:', error);
    res.status(500).json({ error: 'Failed to reset timer' });
  }
});

