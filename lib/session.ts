import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  challenge?: string;
  // For email verification flow
  verifiedEmail?: string;
}

// Validate SESSION_SECRET at startup
if (!process.env.SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET environment variable is required.\n' +
    'Generate one with: openssl rand -base64 32\n' +
    'Then add it to your .env.local file.'
  );
}

if (process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    'SESSION_SECRET must be at least 32 characters long.\n' +
    'Generate a secure one with: openssl rand -base64 32'
  );
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'daily_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

