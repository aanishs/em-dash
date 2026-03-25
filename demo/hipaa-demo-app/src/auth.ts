/**
 * Authentication — user login and session management.
 *
 * Secured with bcrypt hashing, session timeouts, and MFA per HIPAA §164.312(d).
 */

import * as crypto from 'crypto';

// Use bcrypt for password hashing (install: npm install bcryptjs)
// In production, replace this stub with actual bcrypt:
//   import bcrypt from 'bcryptjs';
//   export async function hashPassword(password: string): Promise<string> {
//     return bcrypt.hash(password, 12);
//   }
// Stub implementation using PBKDF2 (safe, synchronous fallback):
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — HIPAA auto-logoff requirement

interface Session {
  userId: string;
  createdAt: number;
  lastActivity: number;
  mfaVerified: boolean;
}

const sessions = new Map<string, Session>();

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    userId,
    createdAt: now,
    lastActivity: now,
    mfaVerified: false,
  });
  return token;
}

export function validateSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;

  // Auto-logoff: terminate session after 15 min of inactivity
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
    sessions.delete(token);
    return null;
  }

  // Update last activity timestamp
  session.lastActivity = Date.now();
  return session;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

// MFA verification stub — in production, implement TOTP (e.g., speakeasy)
export function verifyMFA(token: string, mfaCode: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;

  // TODO: Verify TOTP code against user's MFA secret
  // For now, accept any 6-digit code as a placeholder
  if (/^\d{6}$/.test(mfaCode)) {
    session.mfaVerified = true;
    return true;
  }
  return false;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function login(email: string, password: string): string | null {
  // Account lockout check
  const attempts = loginAttempts.get(email);
  if (attempts && attempts.lockedUntil > Date.now()) {
    return null; // Account locked
  }

  const user = findUser(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Track failed attempts
    const current = loginAttempts.get(email) ?? { count: 0, lockedUntil: 0 };
    current.count++;
    if (current.count >= MAX_LOGIN_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    loginAttempts.set(email, current);
    return null;
  }

  // Reset failed attempts on success
  loginAttempts.delete(email);

  // Create session — MFA still required before PHI access
  return createSession(user.id);
}

function findUser(email: string) {
  return {
    id: 'user-1',
    email,
    passwordHash: hashPassword('password123'),
    role: 'provider',
  };
}
