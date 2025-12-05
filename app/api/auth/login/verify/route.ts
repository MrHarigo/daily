import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

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

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const body = await request.json();
    
    const expectedChallenge = session.challenge;
    
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'No challenge found' }, { status: 400 });
    }
    
    const credential = await queryOne<{
      id: string;
      user_id: string;
      public_key: string;
      counter: number;
      transports: string;
    }>('SELECT * FROM credentials WHERE id = $1', [body.id]);
    
    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
    }
    
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(Buffer.from(credential.public_key, 'base64')),
        counter: credential.counter ?? 0,
        transports: parseTransports(credential.transports),
      },
    });
    
    if (verification.verified) {
      await queryOne(
        'UPDATE credentials SET counter = $1 WHERE id = $2',
        [verification.authenticationInfo.newCounter, body.id]
      );
      
      session.userId = credential.user_id;
      await session.save();
      
      return NextResponse.json({ verified: true });
    }
    
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  } catch (error) {
    console.error('Login verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

