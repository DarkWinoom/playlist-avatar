import { describe, expect, it } from 'vitest';
import { BoundedQueue, ByteCache } from './queue.ts';
import { ServiceError } from './errors.ts';
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
describe('bounded work', () => {
  it('holds exactly two active and eight waiting slots, then releases them', async () => {
    const queue = new BoundedQueue(2, 8), gate = deferred(), signal = new AbortController().signal;
    const tasks = Array.from({ length: 10 }, () => queue.run(() => gate.promise, signal));
    await Promise.resolve();
    expect(queue.snapshot()).toEqual({ running: 2, waiting: 8 });
    await expect(queue.run(async () => {}, signal)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    gate.resolve(); await Promise.all(tasks);
    expect(queue.snapshot()).toEqual({ running: 0, waiting: 0 });
  });
  it('removes a cancelled waiter without consuming a later slot', async () => {
    const queue = new BoundedQueue(1, 2), gate = deferred();
    const first = queue.run(() => gate.promise, new AbortController().signal);
    const controller = new AbortController();
    const waiting = queue.run(async () => {}, controller.signal);
    const check = expect(waiting).rejects.toMatchObject({ code: 'CANCELLED' });
    controller.abort(); await check;
    expect(queue.snapshot()).toEqual({ running: 1, waiting: 0 });
    gate.resolve(); await first; expect(queue.snapshot().running).toBe(0);
  });
  it('holds streaming leases until their explicit release', async () => {
    const queue = new BoundedQueue(1, 2), signal = new AbortController().signal;
    const release = await queue.acquire(signal);
    expect(queue.snapshot().running).toBe(1);
    let entered = false;
    const second = queue.run(async () => { entered = true; }, signal);
    await Promise.resolve(); expect(entered).toBe(false);
    release(); await second; expect(queue.snapshot().running).toBe(0);
  });
  it('preserves total-deadline timeouts while waiting in the queue', async () => {
    const queue = new BoundedQueue(1, 2), gate = deferred();
    const first = queue.run(() => gate.promise, new AbortController().signal);
    const controller = new AbortController(), waiting = queue.run(async () => {}, controller.signal);
    const check = expect(waiting).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', status: 504 });
    controller.abort(new ServiceError('UPSTREAM_TIMEOUT', 504)); await check;
    gate.resolve(); await first;
  });
  it('evicts by bytes while keeping recently read entries', () => {
    const cache = new ByteCache<number>(10, 10000);
    cache.set('a', 1, 4); cache.set('b', 2, 4); cache.get('a'); cache.set('c', 3, 4);
    expect(cache.get('b')).toBeUndefined(); expect(cache.get('a')).toBe(1);
    cache.set('oversized', 4, 11); expect(cache.get('oversized')).toBeUndefined();
  });
});
