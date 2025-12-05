import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { sessionOptions, SessionData } from '@/lib/session';

const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';

// Direct passkey login - no email verification required
// Uses discoverable credentials (resident keys)
export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    // Generate options WITHOUT allowCredentials - browser will show available passkeys
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      // Empty allowCredentials = browser shows all available passkeys for this domain
    });

    session.challenge = options.challenge;
    await session.save();

    return NextResponse.json(options);
  } catch (error) {
    console.error('Passkey login options error:', error);
    return NextResponse.json({ error: 'Failed to generate options' }, { status: 500 });
  }
}

