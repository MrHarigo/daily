import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const dayoffs = await query(`SELECT to_char(date, 'YYYY-MM-DD') as date, reason FROM day_offs`);
    return NextResponse.json(dayoffs);
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const { date, reason } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    const dayoff = await query(
      `INSERT INTO day_offs (date, reason) VALUES ($1, $2) ON CONFLICT (date) DO UPDATE SET reason = $2
       RETURNING to_char(date, 'YYYY-MM-DD') as date, reason`,
      [date, reason || null]
    );
    return NextResponse.json(dayoff[0]);
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    await query('DELETE FROM day_offs WHERE date = $1', [date]);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

