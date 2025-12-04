import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

interface Holiday {
  date: string;
  name: string;
  name_en: string | null;
  year: number;
}

interface DayOff {
  date: string;
  reason: string | null;
}

// Fetch Japanese holidays from API and cache them
async function fetchAndCacheHolidays(year: number): Promise<Holiday[]> {
  try {
    // Using the Japanese Holiday API (Syukujitsu API)
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/JP`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch holidays: ${response.statusText}`);
    }

    const data = await response.json() as Array<{
      date: string;
      localName: string;
      name: string;
    }>;

    // Insert holidays into database
    for (const holiday of data) {
      await query(
        `INSERT INTO holidays (date, name, name_en, year)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date) DO UPDATE SET name = $2, name_en = $3`,
        [holiday.date, holiday.localName, holiday.name, year]
      );
    }

    // Return cached holidays
    return await query<Holiday>(
      'SELECT date, name, name_en, year FROM holidays WHERE year = $1 ORDER BY date',
      [year]
    );
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    throw error;
  }
}

// Get holidays for a year (fetch if not cached)
calendarRouter.get('/holidays/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Check if we have cached holidays for this year
    let holidays = await query<Holiday>(
      'SELECT date, name, name_en, year FROM holidays WHERE year = $1 ORDER BY date',
      [year]
    );

    if (holidays.length === 0) {
      // Fetch and cache holidays
      holidays = await fetchAndCacheHolidays(year);
    }

    res.json(holidays);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'Failed to get holidays' });
  }
});

// Force refresh holidays for a year
calendarRouter.post('/holidays/:year/refresh', async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Delete existing holidays for this year
    await query('DELETE FROM holidays WHERE year = $1', [year]);

    // Fetch and cache new holidays
    const holidays = await fetchAndCacheHolidays(year);

    res.json(holidays);
  } catch (error) {
    console.error('Refresh holidays error:', error);
    res.status(500).json({ error: 'Failed to refresh holidays' });
  }
});

// Get day-offs
calendarRouter.get('/day-offs', async (req, res) => {
  try {
    const { year } = req.query;

    let dayOffs: DayOff[];

    if (year) {
      dayOffs = await query<DayOff>(
        `SELECT date, reason FROM day_offs 
         WHERE EXTRACT(YEAR FROM date) = $1 
         ORDER BY date`,
        [year]
      );
    } else {
      dayOffs = await query<DayOff>(
        'SELECT date, reason FROM day_offs ORDER BY date'
      );
    }

    res.json(dayOffs);
  } catch (error) {
    console.error('Get day-offs error:', error);
    res.status(500).json({ error: 'Failed to get day-offs' });
  }
});

// Add a day-off
calendarRouter.post('/day-offs', async (req, res) => {
  try {
    const { date, reason } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const dayOff = await queryOne<DayOff>(
      `INSERT INTO day_offs (date, reason)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE SET reason = $2
       RETURNING date, reason`,
      [date, reason || null]
    );

    res.json(dayOff);
  } catch (error) {
    console.error('Add day-off error:', error);
    res.status(500).json({ error: 'Failed to add day-off' });
  }
});

// Remove a day-off
calendarRouter.delete('/day-offs/:date', async (req, res) => {
  try {
    const { date } = req.params;

    await query('DELETE FROM day_offs WHERE date = $1', [date]);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove day-off error:', error);
    res.status(500).json({ error: 'Failed to remove day-off' });
  }
});

// Check if a date is a working day
calendarRouter.get('/is-working-day/:date', async (req, res) => {
  try {
    const dateStr = req.params.date;
    const date = new Date(dateStr);

    // Check if weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.json({ isWorkingDay: false, reason: 'weekend' });
    }

    // Check if Japanese holiday
    const holiday = await queryOne<Holiday>(
      'SELECT name FROM holidays WHERE date = $1',
      [dateStr]
    );
    if (holiday) {
      return res.json({ isWorkingDay: false, reason: 'holiday', holiday: holiday.name });
    }

    // Check if custom day-off
    const dayOff = await queryOne<DayOff>(
      'SELECT reason FROM day_offs WHERE date = $1',
      [dateStr]
    );
    if (dayOff) {
      return res.json({ isWorkingDay: false, reason: 'day-off', dayOffReason: dayOff.reason });
    }

    res.json({ isWorkingDay: true });
  } catch (error) {
    console.error('Check working day error:', error);
    res.status(500).json({ error: 'Failed to check working day' });
  }
});

// Get all non-working days for a date range
calendarRouter.get('/non-working-days', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get holidays in range
    const holidays = await query<Holiday>(
      'SELECT date, name, name_en FROM holidays WHERE date >= $1 AND date <= $2',
      [start_date, end_date]
    );

    // Get day-offs in range
    const dayOffs = await query<DayOff>(
      'SELECT date, reason FROM day_offs WHERE date >= $1 AND date <= $2',
      [start_date, end_date]
    );

    // Generate weekends
    const weekends: string[] = [];
    const start = new Date(start_date as string);
    const end = new Date(end_date as string);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends.push(d.toISOString().split('T')[0]);
      }
    }

    res.json({
      holidays: holidays.map(h => ({ date: h.date, name: h.name })),
      dayOffs: dayOffs.map(d => ({ date: d.date, reason: d.reason })),
      weekends,
    });
  } catch (error) {
    console.error('Get non-working days error:', error);
    res.status(500).json({ error: 'Failed to get non-working days' });
  }
});

