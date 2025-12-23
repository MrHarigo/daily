import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const rpName = 'Daily Habits';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// Get registration options for adding a new device (when already logged in)
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Get user info
    const user = await queryOne<{ id: string; username: string }>(
      'SELECT id, username FROM users WHERE id = $1',
      [auth.userId]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get existing credentials to exclude
    const existingCreds = await query<{ id: string }>(
      'SELECT id FROM credentials WHERE user_id = $1',
      [auth.userId]
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
    await session.save();

    return NextResponse.json(options);
  } catch (err) {
    console.error('Add device options error:', err);
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 });
  }
}

// Verify and save the new device credential
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const body = await request.json();

    const expectedChallenge = session.challenge;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No challenge found' }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      // Get device name from user agent
      const userAgent = request.headers.get('user-agent') || '';
      let deviceName = 'Unknown Device';
      if (userAgent.includes('iPhone')) deviceName = 'iPhone';
      else if (userAgent.includes('iPad')) deviceName = 'iPad';
      else if (userAgent.includes('Android')) deviceName = 'Android';
      else if (userAgent.includes('Mac')) deviceName = 'Mac';
      else if (userAgent.includes('Windows')) deviceName = 'Windows';
      else if (userAgent.includes('Linux')) deviceName = 'Linux';

      await queryOne(
        `INSERT INTO credentials (id, user_id, public_key, counter, transports, device_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          credential.id,
          auth.userId,
          Buffer.from(credential.publicKey).toString('base64'),
          credential.counter,
          JSON.stringify(body.response.transports || []),
          deviceName,
        ]
      );

      session.challenge = undefined;
      await session.save();

      return NextResponse.json({ verified: true, deviceName });
    }

    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  } catch (err) {
    console.error('Add device verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

