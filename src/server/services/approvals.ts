type Resolver = (approved: boolean) => void;

const pending = new Map<string, { resolve: Resolver; timer: ReturnType<typeof setTimeout> }>();

export function waitForApproval(name: string, timeoutMs = 90_000): Promise<boolean> {
  const key = name.toLowerCase().trim();
  cancelPending(key);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      resolve(false);
    }, timeoutMs);
    pending.set(key, { resolve, timer });
  });
}

export function approveVisitor(name: string): boolean {
  const key = name.toLowerCase().trim();
  const entry = pending.get(key);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(key);
  entry.resolve(true);
  return true;
}

function cancelPending(key: string) {
  const entry = pending.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(key);
  }
}
