const attempts = new Map<string, { count: number; windowStart: number; lockedUntil?: number }>();

const WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; msRemaining: number };

export function checkRateLimit(callerNumber: string): RateLimitResult {
  const now = Date.now();
  const record = attempts.get(callerNumber);

  // Lockout expired → clean slate
  if (record?.lockedUntil && now >= record.lockedUntil) {
    attempts.delete(callerNumber);
  }

  const current = attempts.get(callerNumber);

  if (!current) {
    attempts.set(callerNumber, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (current.lockedUntil) {
    return { allowed: false, msRemaining: current.lockedUntil - now };
  }

  // Attempt window expired without hitting the limit → fresh start
  if (now - current.windowStart > WINDOW_MS) {
    attempts.set(callerNumber, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (current.count >= MAX_ATTEMPTS) {
    current.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, msRemaining: LOCKOUT_MS };
  }

  current.count++;
  return { allowed: true };
}

export interface LockoutInfo {
  callerId: string;
  msRemaining: number;
}

export function getActiveLockouts(): LockoutInfo[] {
  const now = Date.now();
  const result: LockoutInfo[] = [];
  for (const [callerId, record] of attempts.entries()) {
    if (record.lockedUntil && record.lockedUntil > now) {
      result.push({ callerId, msRemaining: record.lockedUntil - now });
    }
  }
  return result;
}
