export class SessionStore<T> {
  private readonly sessions = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  set(key: string, value: T): void {
    this.sessions.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
  }

  get(key: string): T | undefined {
    const entry = this.sessions.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(key);
      return undefined;
    }

    return entry.value;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessions.entries()) {
      if (entry.expiresAt <= now) {
        this.sessions.delete(key);
      }
    }
  }
}
