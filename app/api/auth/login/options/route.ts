import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';
import { query } from '@/lib/db';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';

function parseTransports(transports: unknown): AuthenticatorTransportFuture[] {
  if (!transports) return [];
  // Already an array
  if (Array.isArray(transports)) return transports as AuthenticatorTransportFuture[];
  // String - try JSON parse first, then comma-separated
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
    
    const credentials = await query<{ id: string; transports: string }>(
      'SELECT id, transports FROM credentials'
    );
    
    if (credentials.length === 0) {
      return NextResponse.json({ error: 'No credentials found' }, { status: 400 });
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
    await session.save();
    
    return NextResponse.json(options);
  } catch (error) {
    console.error('Login options error:', error);
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 });
  }
}

