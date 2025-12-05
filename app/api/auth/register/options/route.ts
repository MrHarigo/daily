import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { query, queryOne } from '@/lib/db';

const rpName = 'Daily Habits';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    
    let user = await queryOne<{ id: string; username: string }>('SELECT id, username FROM users LIMIT 1');
    
    if (!user) {
      user = await queryOne<{ id: string; username: string }>(
        "INSERT INTO users (username) VALUES ('default') RETURNING id, username"
      );
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
    
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
