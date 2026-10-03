import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { publicError, ServiceError } from './errors.ts';

describe('server boundary', () => {
  it('does not return deployment secrets or service addresses from public capabilities', async () => {
    const config = loadConfig({ LASTFM_API_KEY: 'private-test-key', ALLOWED_SERVICES: JSON.stringify([
      { id: 'library', kind: 'subsonic', name: 'Library', baseUrl: 'http://fixture-library:4533', allowPrivate: true }]) });
    const response = await createApp(config).request('http://127.0.0.1:8080/api/v1/capabilities');
    const body = await response.text();
    expect(response.status).toBe(200); expect(body).not.toContain('private-test-key'); expect(body).not.toContain('fixture-library');
    expect(body).toContain('Library');
  });
  it('rejects foreign origins and unconfigured hosts', async () => {
    const app = createApp(loadConfig({}));
    expect((await app.request('http://127.0.0.1:8080/healthz', { headers: { Origin: 'https://example.org' } })).status).toBe(403);
    expect((await app.request('http://example.org/healthz')).status).toBe(403);
  });
  it('does not expose raw errors and preserves retryable categories', () => {
    expect(JSON.stringify(publicError(new Error('token=secret')))).not.toContain('secret');
    expect(publicError(new ServiceError('RATE_LIMITED', 429, 2000)).body.error).toEqual({ code: 'RATE_LIMITED', retryable: true, retryAfterMs: 2000 });
  });
  it('rejects service addresses containing credentials', () => {
    expect(() => loadConfig({ ALLOWED_SERVICES: JSON.stringify([{ id: 'a', kind: 'jellyfin', name: 'A', baseUrl: 'http://user:password@fixture' }]) })).toThrow();
  });
});
