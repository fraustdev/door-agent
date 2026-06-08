import { getTodaysWord } from "./sheets.js";
import { getActiveVisitors } from "./calendar.js";

const INJECTION_PATTERNS = [
  /access\s*(granted|approved|denied|allowed|authorized)/i,
  /door\s*(open|unlock|unlocked)/i,
  /\b(granted|approved|authorized|unlocked|allowed)\b/i,
  /you\s*(may|can)\s*(enter|come\s*in|pass)/i,
  /let\s*(me|you|them)\s*(in|enter|pass)/i,
  /\b(override|bypass|admin)\b/i,
  /ignore\s*(previous|prior|above|instructions)/i,
  /system\s*(command|override|prompt)/i,
];

export function isInjectionAttempt(input: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(input));
}

export interface AuthResult {
  outcome: "granted" | "denied";
  wordExpected: string | null;
  matchDistance: number | null;
  grantedBy?: "word" | "visitor";
  visitorName?: string;
}

export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function allowedDistance(word: string): number {
  return word.length <= 4 ? 0 : 1;
}

export async function verifyIdentity(input: string): Promise<AuthResult> {
  const normalized = input.toLowerCase().trim();

  // Check word of the day
  const todaysWord = await getTodaysWord();
  if (todaysWord) {
    const matchDistance = levenshtein(normalized, todaysWord);
    if (matchDistance <= allowedDistance(todaysWord)) {
      return { outcome: "granted", wordExpected: todaysWord, matchDistance, grantedBy: "word" };
    }
  }

  // Check active visitor windows
  for (const visitor of getActiveVisitors()) {
    const distance = levenshtein(normalized, visitor.firstName);
    if (distance <= allowedDistance(visitor.firstName)) {
      return {
        outcome: "granted",
        wordExpected: visitor.firstName,
        matchDistance: distance,
        grantedBy: "visitor",
        visitorName: visitor.displayName,
      };
    }
  }

  return { outcome: "denied", wordExpected: todaysWord ?? null, matchDistance: null };
}
