import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  challenge?: string;
  // For email verification flow
  verifiedEmail?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'daily_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

