const recentIds = new Map<string, number>();
const IDEMPOTENCY_TTL = 10_000; // 10 seconds

export function remember(id: string): void {
  recentIds.set(id, Date.now());
  setTimeout(() => {
    recentIds.delete(id);
  }, IDEMPOTENCY_TTL);
}

export function seen(id: string): boolean {
  return recentIds.has(id);
}
