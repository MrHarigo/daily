import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// List all devices/passkeys for current user
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const devices = await query<{
      id: string;
      device_name: string;
      created_at: string;
    }>(
      `SELECT id, device_name, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at 
       FROM credentials WHERE user_id = $1 ORDER BY created_at DESC`,
      [auth.userId]
    );

    return NextResponse.json(devices);
  } catch (err) {
    console.error('Get devices error:', err);
    return NextResponse.json({ error: 'Failed to get devices' }, { status: 500 });
  }
}

// Remove a device/passkey
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get('id');

    if (!credentialId) {
      return NextResponse.json({ error: 'Credential ID required' }, { status: 400 });
    }

    // Check how many credentials the user has
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM credentials WHERE user_id = $1',
      [auth.userId]
    );

    if (parseInt(countResult?.count || '0') <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove your only passkey. Add another device first.' },
        { status: 400 }
      );
    }

    // Remove the credential
    const result = await queryOne(
      'DELETE FROM credentials WHERE id = $1 AND user_id = $2 RETURNING id',
      [credentialId, auth.userId]
    );

    if (!result) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Remove device error:', err);
    return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
  }
}

