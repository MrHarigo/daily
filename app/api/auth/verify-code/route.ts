import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { query, queryOne } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid, unused code
    const validCode = await queryOne<{ id: string }>(
      `SELECT id FROM verification_codes 
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, code]
    );

    if (!validCode) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Mark code as used
    await queryOne(
      'UPDATE verification_codes SET used = TRUE WHERE id = $1',
      [validCode.id]
    );

    // Check if user exists
    const existingUser = await queryOne<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // Store verified email in session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.verifiedEmail = normalizedEmail;
    await session.save();

    if (existingUser) {
      // User exists - they need to register a passkey for this device
      return NextResponse.json({
        success: true,
        isNewUser: false,
        userId: existingUser.id,
        username: existingUser.username,
      });
    } else {
      // New user - they'll need to pick a username and register passkey
      return NextResponse.json({
        success: true,
        isNewUser: true,
      });
    }
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}

