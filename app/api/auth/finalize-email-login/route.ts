import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';

// Finalize login for users who verified email but already have a passkey registered
export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.verifiedEmail) {
      return NextResponse.json(
        { error: 'No verified email in session' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await queryOne<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE email = $1',
      [session.verifiedEmail]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Set session as logged in
    session.userId = user.id;
    session.verifiedEmail = undefined;
    session.challenge = undefined;
    await session.save();

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Finalize email login error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize login' },
      { status: 500 }
    );
  }
}

