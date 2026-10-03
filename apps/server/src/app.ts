import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONTRACT_VERSION, LIMITS, CapabilitiesSchema } from '@playlist-avatar/contracts';
import type { ServerConfig } from './config.ts';
import { publicError, ServiceError } from './errors.ts';

export function createApp(config: ServerConfig) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    const host = context.req.header('host') || new URL(context.req.url).host;
    if (!config.allowedHosts.has(host)) throw new ServiceError('INVALID_INPUT', 403);
    const origin = context.req.header('origin');
    if (origin && !config.allowedOrigins.has(origin)) throw new ServiceError('INVALID_INPUT', 403);
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    context.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    await next();
  });
  app.onError((error, context) => {
    const failure = publicError(error);
    if (failure.body.error.code === 'INTERNAL_ERROR') console.error(JSON.stringify({ category: 'INTERNAL_ERROR' }));
    return context.json(failure.body, { status: failure.status });
  });
  app.get('/healthz', context => context.json({ status: 'ok', version: '0.1.0', contractVersion: CONTRACT_VERSION }));
  app.get('/api/v1/capabilities', context => context.json(CapabilitiesSchema.parse({ version: CONTRACT_VERSION,
    limits: { metadata: LIMITS.metadata, candidates: LIMITS.candidates, selected: LIMITS.selected },
    sources: [{ id: 'local', state: 'available' }, { id: 'netease', state: 'unsupported' }, { id: 'qqmusic', state: 'unsupported' },
      { id: 'lastfm', state: config.lastfmKey ? 'unsupported' : 'unconfigured' }, { id: 'subsonic', state: 'disabled' }, { id: 'jellyfin', state: 'disabled' }],
    profiles: config.advancedProfiles.map(({ id, kind, name }) => ({ id, kind, name })) })));
  app.all('/api/*', () => { throw new ServiceError('UNSUPPORTED_SOURCE', 501); });
  app.use('*', serveStatic({ root: config.staticRoot }));
  app.get('*', serveStatic({ path: `${config.staticRoot}/index.html` }));
  return app;
}
