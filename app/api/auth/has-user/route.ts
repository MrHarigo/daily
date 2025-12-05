import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function GET() {
  try {
    const credential = await queryOne('SELECT id FROM credentials LIMIT 1');
    return NextResponse.json({ hasUser: !!credential });
  } catch (error) {
    console.error('Has-user error:', error);
    return NextResponse.json({ error: 'Failed to check user' }, { status: 500 });
  }
}

