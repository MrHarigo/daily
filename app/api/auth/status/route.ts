import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (session.userId) {
    // Get user info
    const user = await queryOne<{ id: string; email: string; username: string }>(
      'SELECT id, email, username FROM users WHERE id = $1',
      [session.userId]
    );

    if (user) {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      });
    }

    // User not found - clear invalid session
    session.userId = undefined;
    await session.save();
  }

  return NextResponse.json({ authenticated: false });
}
