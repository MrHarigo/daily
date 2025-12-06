import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationCode(email: string, code: string) {
  const { error } = await resend.emails.send({
    from: 'Daily Habits <noreply@daily.harigo.me>',
    to: email,
    subject: `Your verification code: ${code}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #00d4aa; font-size: 24px; margin-bottom: 24px;">Daily Habits</h1>
        <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
          Enter this code to verify your email:
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">
            ${code}
          </span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code expires in 10 minutes.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send verification code');
  }
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

