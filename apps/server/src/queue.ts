import { ServiceError, abortError } from './errors.ts';

interface Waiting { start(): void; reject(error: unknown): void; signal: AbortSignal; abort(): void }
export class BoundedQueue {
  private running = 0;
  private waiting: Waiting[] = [];
  private readonly concurrency: number;
  private readonly capacity: number;
  constructor(concurrency: number, capacity: number) { this.concurrency = concurrency; this.capacity = capacity; }
  async acquire(signal: AbortSignal): Promise<() => void> {
    let release!: () => void;
    let entered!: () => void;
    let failed!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { entered = resolve; failed = reject; });
    const held = new Promise<void>(resolve => { release = resolve; });
    void this.run(async () => { entered(); await held; }, signal).catch(failed);
    await ready;
    let released = false;
    return () => { if (!released) { released = true; release(); } };
  }
  async run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) throw abortError(signal);
    await new Promise<void>((resolve, reject) => {
      if (this.running < this.concurrency) { this.running++; resolve(); return; }
      if (this.waiting.length >= this.capacity) { reject(new ServiceError('RATE_LIMITED', 429, 1000)); return; }
      const item: Waiting = { signal, reject, start: () => { signal.removeEventListener('abort', item.abort); this.running++; resolve(); },
        abort: () => { this.waiting = this.waiting.filter(value => value !== item); reject(abortError(signal)); } };
      signal.addEventListener('abort', item.abort, { once: true }); this.waiting.push(item);
    });
    try { if (signal.aborted) throw abortError(signal); return await task(); }
    finally {
      this.running--;
      while (this.waiting.length && this.running < this.concurrency) {
        const next = this.waiting.shift()!;
        if (next.signal.aborted) { next.signal.removeEventListener('abort', next.abort); next.reject(abortError(next.signal)); }
        else next.start();
      }
    }
  }
  snapshot() { return { running: this.running, waiting: this.waiting.length }; }
}

export class ByteCache<T> {
  private items = new Map<string, { value: T; bytes: number; expires: number }>();
  private bytes = 0;
  private readonly budget: number;
  private readonly ttl: number;
  constructor(budget: number, ttl: number) { this.budget = budget; this.ttl = ttl; }
  get(key: string): T | undefined {
    const entry = this.items.get(key);
    if (!entry) return;
    if (entry.expires <= Date.now()) { this.remove(key); return; }
    this.items.delete(key); this.items.set(key, entry); return entry.value;
  }
  set(key: string, value: T, bytes: number) {
    this.remove(key);
    if (bytes > this.budget) return;
    while (this.bytes + bytes > this.budget && this.items.size) this.remove(this.items.keys().next().value!);
    this.items.set(key, { value, bytes, expires: Date.now() + this.ttl }); this.bytes += bytes;
  }
  private remove(key: string) { const entry = this.items.get(key); if (entry) this.bytes -= entry.bytes; this.items.delete(key); }
}
