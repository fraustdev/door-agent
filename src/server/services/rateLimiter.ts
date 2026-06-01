const attempts = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; msRemaining: number };

export function checkRateLimit(callerNumber: string): RateLimitResult {
  const now = Date.now();
  const record = attempts.get(callerNumber);

  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(callerNumber, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, msRemaining: WINDOW_MS - (now - record.windowStart) };
  }

  record.count++;
  return { allowed: true };
}
