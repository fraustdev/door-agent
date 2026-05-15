const attempts = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export function checkRateLimit(callerNumber: string): boolean {
  const now = Date.now();
  const record = attempts.get(callerNumber);

  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(callerNumber, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}
