import { OAuth2Client } from 'google-auth-library';
import { upsertUser, getUser } from './db.ts';
import type { User } from '../types/email.ts';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (process.env.APP_URL ? `${process.env.APP_URL}/api/auth/google/callback` : 'http://localhost:3000/api/auth/google/callback');

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getGoogleOAuthClient(): OAuth2Client {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
}

export function generateGoogleAuthUrl(): string {
  if (!isGoogleOAuthConfigured()) {
    throw new Error(
      'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.'
    );
  }

  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
  });
}

export async function handleGoogleOAuthCallback(code: string): Promise<User> {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('Google did not return an id_token in the OAuth response.');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Could not retrieve user email from Google ID token.');
  }

  // Persist real authenticated user into PostgreSQL
  const authenticatedUser = await upsertUser({
    id: `usr_${payload.sub}`,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture,
  });

  return authenticatedUser;
}
