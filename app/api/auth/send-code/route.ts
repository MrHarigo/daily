import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendVerificationCode, generateCode } from '@/lib/email';

// Rate limiting: max 3 codes per email per 10 minutes
const MAX_CODES_PER_WINDOW = 3;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check rate limit
    const recentCodes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM verification_codes 
       WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [normalizedEmail]
    );

    if (parseInt(recentCodes[0]?.count || '0') >= MAX_CODES_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes.' },
        { status: 429 }
      );
    }

    // Generate and store code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await queryOne(
      `INSERT INTO verification_codes (email, code, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [normalizedEmail, code, expiresAt]
    );

    // Send email
    await sendVerificationCode(normalizedEmail, code);

    // Check if user exists (for frontend to know if this is registration or login)
    const existingUser = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    return NextResponse.json({
      success: true,
      isNewUser: !existingUser,
    });
  } catch (err) {
    console.error('Send code error:', err);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

