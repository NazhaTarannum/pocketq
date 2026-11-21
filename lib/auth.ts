/**
 * @file lib/auth.ts
 * @description Stateless JWT session signing, verification, admin role checks, and HTTP-only cookie management.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'pocketq_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is required in production.');
    }
    return new TextEncoder().encode('pocketq-local-development-secret-key-change-in-production');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Checks whether an email matches the configured ADMIN_EMAIL(s) environment variable.
 */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || '';
  if (!raw.trim()) return false;
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Signs a 30-day JWT session token containing the authenticated user's identity.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    isAdmin: Boolean(payload.isAdmin || isAdminEmail(payload.email)),
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
        isAdmin: Boolean(payload.isAdmin || isAdminEmail(payload.email)),
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
