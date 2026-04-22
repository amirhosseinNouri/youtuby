export class UserRateLimiter {
  private readonly hits = new Map<number, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  allow(userId: number): boolean {
    const now = Date.now();
    const earliest = now - this.windowMs;
    const current = this.hits.get(userId) ?? [];
    const filtered = current.filter((hit) => hit >= earliest);

    if (filtered.length >= this.maxRequests) {
      this.hits.set(userId, filtered);
      return false;
    }

    filtered.push(now);
    this.hits.set(userId, filtered);
    return true;
  }
}
