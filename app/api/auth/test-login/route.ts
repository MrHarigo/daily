import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';
import { TEST_USER } from '@/e2e/test-config';

/**
 * Test Login Endpoint
 *
 * SECURITY MODEL:
 * 1. Only available in non-production environments (NODE_ENV check)
 * 2. Only allows login as designated test user (email whitelist)
 * 3. Even if exposed, can't access real user accounts
 * 4. Test user contains no real data
 *
 * Usage:
 *   POST /api/auth/test-login
 *   Body: { email: "e2e-test@example.com" }
 */
export async function POST(request: NextRequest) {
  // SECURITY LAYER 1: Environment check
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] Test login endpoint accessed in production');
    return NextResponse.json(
      { error: 'Not available' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // SECURITY LAYER 2: Test user whitelist
    // Only allow login as the designated test user
    if (email !== TEST_USER.email) {
      console.warn(`[SECURITY] Test login attempt with unauthorized email: ${email}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 403 }
      );
    }

    // Find the test user in database
    const user = await queryOne<{ id: string; email: string; username: string }>(
      'SELECT id, email, username FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Test user not found. Run: npm run db:seed-test-user' },
        { status: 404 }
      );
    }

    // Set session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = user.id;
    session.verifiedEmail = undefined;
    session.challenge = undefined;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      message: 'Test login successful',
    });
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json(
      { error: 'Test login failed' },
      { status: 500 }
    );
  }
}

/**
 * Check if test login is available
 *
 * NOTE: Minimal information disclosure - doesn't reveal environment details
 */
export async function GET() {
  const available = process.env.NODE_ENV !== 'production';

  return NextResponse.json({
    available,
    message: available ? 'Available' : 'Not available',
  });
}
