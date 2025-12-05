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
      
      await queryOne(
        `INSERT INTO credentials (id, user_id, public_key, counter, transports)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          credential.id,
          userId,
          Buffer.from(credential.publicKey).toString('base64'),
          credential.counter,
          JSON.stringify(body.response.transports || []),
        ]
      );
      
      await session.save();
      return NextResponse.json({ verified: true });
    }
    
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  } catch (error) {
    console.error('Registration verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

