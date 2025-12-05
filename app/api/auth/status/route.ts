import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  
  if (session.userId) {
    return NextResponse.json({ authenticated: true, userId: session.userId });
  }
  return NextResponse.json({ authenticated: false });
}

