/**
 * Authentication — user login and session management.
 *
 * INTENTIONALLY INSECURE for em-dash demo purposes.
 */

import * as crypto from 'crypto';

// VIOLATION: MD5 for password hashing — §164.312(d)
export function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// VIOLATION: No session timeout — §164.312(a)(2)(iii)
export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    // No expiresAt — session never times out
    // No lastActivity tracking for idle timeout
  });
  return token;
}

// VIOLATION: No MFA — §164.312(d)
export function login(email: string, password: string): string | null {
  const user = findUser(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  // No MFA check, no login attempt limiting, no account lockout
  return createSession(user.id);
}

const sessions = new Map<string, { userId: string; createdAt: number }>();

function findUser(email: string) {
  return {
    id: 'user-1',
    email,
    passwordHash: hashPassword('password123'),
    role: 'admin', // Everyone is admin — no role differentiation
  };
}
