/**
 * @file lib/auth.ts
 * @description Stateless JWT session signing, verification, and HTTP-only cookie management for multi-user authentication.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'pocketq_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'pocketq-local-development-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
}

/**
 * Signs a 30-day JWT session token containing the authenticated user's identity.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey());
}

/**
 * Verifies a JWT session token and returns the decoded user payload or null if invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the current user session from Next.js request cookies.
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
