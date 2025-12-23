import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const body = await request.json();

    const expectedChallenge = session.challenge;
    const userId = session.userId;

    if (!expectedChallenge || !userId) {
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

      // Store the credential with device info
      const deviceName = getDeviceName(request);
      
      await queryOne(
        `INSERT INTO credentials (id, user_id, public_key, counter, transports, device_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          credential.id,
          userId,
          Buffer.from(credential.publicKey).toString('base64'),
          credential.counter,
          JSON.stringify(body.response.transports || []),
          deviceName,
        ]
      );

      // Clear verification email and challenge, keep user logged in
      session.challenge = undefined;
      session.verifiedEmail = undefined;
      // userId stays set - user is now logged in
      await session.save();

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  } catch (err) {
    console.error('Registration verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

function getDeviceName(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || '';
  
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Linux')) return 'Linux';
  
  return 'Unknown Device';
}
