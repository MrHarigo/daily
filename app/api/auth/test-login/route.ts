import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { queryOne } from '@/lib/db';

/**
 * Test Login Endpoint
 *
 * SECURITY: Only available in development/test environments
 * Allows E2E tests to authenticate without manual passkey interaction
 *
 * Usage:
 *   POST /api/auth/test-login
 *   Body: { email: "test@example.com" } or { userId: "uuid" }
 */
export async function POST(request: NextRequest) {
  // CRITICAL SECURITY: Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test login not available in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, userId } = body;

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Either email or userId required' },
        { status: 400 }
      );
    }

    // Find user by email or userId
    let user;
    if (userId) {
      user = await queryOne<{ id: string; email: string; username: string }>(
        'SELECT id, email, username FROM users WHERE id = $1',
        [userId]
      );
    } else {
      user = await queryOne<{ id: string; email: string; username: string }>(
        'SELECT id, email, username FROM users WHERE email = $1',
        [email]
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Create test user first with seed script.' },
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
 */
export async function GET() {
  return NextResponse.json({
    available: process.env.NODE_ENV !== 'production',
    environment: process.env.NODE_ENV,
    message: process.env.NODE_ENV === 'production'
      ? 'Test login disabled in production'
      : 'Test login available',
  });
}
