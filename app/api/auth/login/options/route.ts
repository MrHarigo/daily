import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { query, queryOne } from '@/lib/db';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';

function parseTransports(transports: unknown): AuthenticatorTransportFuture[] {
  if (!transports) return [];
  if (Array.isArray(transports)) return transports as AuthenticatorTransportFuture[];
  if (typeof transports === 'string') {
    try {
      const parsed = JSON.parse(transports);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return transports.split(',').map(t => t.trim()) as AuthenticatorTransportFuture[];
    }
  }
  return [];
}

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Require verified email
    if (!session.verifiedEmail) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 401 });
    }

    // Get user by email
    const user = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [session.verifiedEmail]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get credentials for this user
    const credentials = await query<{ id: string; transports: string }>(
      'SELECT id, transports FROM credentials WHERE user_id = $1',
      [user.id]
    );

    if (credentials.length === 0) {
      return NextResponse.json({ error: 'No credentials found', needsPasskey: true }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map(cred => ({
        id: cred.id,
        transports: parseTransports(cred.transports),
      })),
      userVerification: 'preferred',
    });

    session.challenge = options.challenge;
    session.userId = user.id; // Store for verify step
    await session.save();

    return NextResponse.json(options);
  } catch (error) {
    console.error('Login options error:', error);
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 });
  }
}
