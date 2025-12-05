import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { query, queryOne } from '@/lib/db';

const rpName = 'Daily Habits';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const { username } = await request.json();

    // Require verified email
    if (!session.verifiedEmail) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 401 });
    }

    const email = session.verifiedEmail;

    // Check if user already exists
    let user = await queryOne<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // New user - username required
      if (!username || typeof username !== 'string' || username.trim().length < 2) {
        return NextResponse.json({ error: 'Username is required (min 2 characters)' }, { status: 400 });
      }

      // Create new user
      user = await queryOne<{ id: string; username: string }>(
        'INSERT INTO users (email, username) VALUES ($1, $2) RETURNING id, username',
        [email, username.trim()]
      );

      if (!user) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
    }

    // Get existing credentials for this user (to exclude from registration)
    const existingCreds = await query<{ id: string }>(
      'SELECT id FROM credentials WHERE user_id = $1',
      [user.id]
    );

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: existingCreds.map(cred => ({
        id: cred.id,
        transports: ['internal'] as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    session.challenge = options.challenge;
    session.userId = user.id;
    await session.save();

    return NextResponse.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 });
  }
}
