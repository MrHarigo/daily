import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    
    // Fetch from Japanese holiday API and cache
    const cached = await query<{ date: string; name: string }>(
      `SELECT to_char(date, 'YYYY-MM-DD') as date, name FROM holidays WHERE EXTRACT(YEAR FROM date) = $1`, [year]
    );
    
    if (cached.length > 0) {
      return NextResponse.json(cached);
    }
    
    // Fetch from API if not cached
    try {
      const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
      const data = await res.json();
      const holidays = Object.entries(data).map(([date, name]) => ({ date, name }));
      
      // Cache in DB
      for (const h of holidays) {
        await query('INSERT INTO holidays (date, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [h.date, h.name]);
      }
      
      return NextResponse.json(holidays);
    } catch {
      return NextResponse.json([]);
    }
  } catch (err) {
    console.error('Fetch holidays error:', err);
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
  }
}

