import { Router } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/types';
import { query, queryOne } from '../db/index.js';

export const authRouter = Router();

// Config from environment
const rpName = process.env.WEBAUTHN_RP_NAME || 'Daily Tracker';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// Session type augmentation
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    challenge?: string;
  }
}

interface DbCredential {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
}

interface DbUser {
  id: string;
  username: string;
}

// Check if user is authenticated
authRouter.get('/status', async (req, res) => {
  if (req.session.userId) {
    const user = await queryOne<DbUser>(
      'SELECT id, username FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (user) {
      return res.json({ authenticated: true, user: { id: user.id, username: user.username } });
    }
  }
  res.json({ authenticated: false });
});

// Check if any credentials exist (for initial setup)
authRouter.get('/has-user', async (req, res) => {
  // Check for credentials, not just users (user might exist without credentials from failed registration)
  const result = await query('SELECT COUNT(*) as count FROM credentials');
  const hasUser = parseInt(result[0].count) > 0;
  res.json({ hasUser });
});

// Generate registration options
authRouter.post('/register/options', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if user already exists
    const existingUser = await queryOne<DbUser>(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    let userId: string;
    
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const newUser = await queryOne<DbUser>(
        'INSERT INTO users (username) VALUES ($1) RETURNING id',
        [username]
      );
      userId = newUser!.id;
    }

    // Get existing credentials for this user
    const existingCredentials = await query<DbCredential>(
      'SELECT id FROM credentials WHERE user_id = $1',
      [userId]
    );

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: username,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.id,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Use platform authenticator (Touch ID)
      },
    });

    // Store challenge in session
    req.session.challenge = options.challenge;
    req.session.userId = userId;

    res.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// Verify registration
authRouter.post('/register/verify', async (req, res) => {
  try {
    const { body } = req;
    const expectedChallenge = req.session.challenge;
    const userId = req.session.userId;

    if (!expectedChallenge || !userId) {
      return res.status(400).json({ error: 'No challenge found in session' });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { registrationInfo } = verification;
      
      // Handle both old and new SimpleWebAuthn API structures
      const credentialId = registrationInfo.credential?.id || (registrationInfo as any).credentialID;
      const publicKey = registrationInfo.credential?.publicKey || (registrationInfo as any).credentialPublicKey;
      const counter = registrationInfo.credential?.counter ?? (registrationInfo as any).counter ?? 0;

      if (!credentialId || !publicKey) {
        console.error('Missing credential data:', registrationInfo);
        return res.status(400).json({ error: 'Invalid credential data' });
      }

      // Store credential in database
      await query(
        `INSERT INTO credentials (id, user_id, public_key, counter, transports)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          credentialId,
          userId,
          Buffer.from(publicKey).toString('base64'),
          counter,
          body.response.transports || [],
        ]
      );

      // Clear challenge from session but keep userId (user is now logged in)
      delete req.session.challenge;

      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    console.error('Registration verify error:', error);
    res.status(500).json({ error: 'Failed to verify registration' });
  }
});

// Generate authentication options
authRouter.post('/login/options', async (req, res) => {
  try {
    // Get all credentials (single user app)
    const credentials = await query<DbCredential>(
      'SELECT id, transports FROM credentials'
    );

    if (credentials.length === 0) {
      return res.status(400).json({ error: 'No credentials registered' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map(cred => ({
        id: cred.id,
        transports: (cred.transports || []) as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });

    req.session.challenge = options.challenge;

    res.json(options);
  } catch (error) {
    console.error('Login options error:', error);
    res.status(500).json({ error: 'Failed to generate login options' });
  }
});

// Verify authentication
authRouter.post('/login/verify', async (req, res) => {
  try {
    const { body } = req;
    const expectedChallenge = req.session.challenge;

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found in session' });
    }

    // Find the credential
    const credential = await queryOne<DbCredential>(
      'SELECT id, user_id, public_key, counter, transports FROM credentials WHERE id = $1',
      [body.id]
    );

    if (!credential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    // Ensure counter is a number (defaults to 0 if null/undefined)
    const counter = credential.counter ?? 0;
    const publicKeyBytes = new Uint8Array(Buffer.from(credential.public_key, 'base64'));

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credential.id,
        credentialPublicKey: publicKeyBytes,
        counter: counter,
        transports: (credential.transports || []) as AuthenticatorTransportFuture[],
      },
    });

    if (verification.verified) {
      // Update counter
      await query(
        'UPDATE credentials SET counter = $1 WHERE id = $2',
        [verification.authenticationInfo.newCounter, credential.id]
      );

      // Set session
      req.session.userId = credential.user_id;
      delete req.session.challenge;

      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    console.error('Login verify error:', error);
    res.status(500).json({ error: 'Failed to verify login' });
  }
});

// Logout
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

