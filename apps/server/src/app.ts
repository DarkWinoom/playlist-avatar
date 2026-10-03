import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONTRACT_VERSION, LIMITS, CapabilitiesSchema } from '@playlist-avatar/contracts';
import type { ServerConfig } from './config.ts';
import { publicError, ServiceError } from './errors.ts';
import { PublicResolver } from './resolve.ts';
import { ResolveInputSchema } from '@playlist-avatar/contracts';

function requestSignal(context: { req: { raw: Request }; env: unknown }) {
  const controller = new AbortController();
  const cancel = () => controller.abort(new ServiceError('CANCELLED', 408));
  const deadline = Date.now() + LIMITS.deadlineMs;
  const timer = setTimeout(() => controller.abort(new ServiceError('UPSTREAM_TIMEOUT', 504)), LIMITS.deadlineMs);
  context.req.raw.signal.addEventListener('abort', cancel, { once: true });
  if (context.req.raw.signal.aborted) cancel();
  const env = context.env as { outgoing?: { once(name: string, fn: () => void): unknown; off(name: string, fn: () => void): unknown; writableEnded: boolean } } | undefined;
  const close = () => { if (!env?.outgoing?.writableEnded) cancel(); };
  env?.outgoing?.once('close', close);
  return { signal: controller.signal, deadline, dispose() { clearTimeout(timer); context.req.raw.signal.removeEventListener('abort', cancel); env?.outgoing?.off('close', close); if (!controller.signal.aborted) cancel(); } };
}

export function createApp(config: ServerConfig) {
  const app = new Hono();
  const resolver = new PublicResolver();
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
    sources: [{ id: 'local', state: 'available' }, { id: 'netease', state: 'available' }, { id: 'qqmusic', state: 'available' },
      { id: 'lastfm', state: config.lastfmKey ? 'unsupported' : 'unconfigured' }, { id: 'subsonic', state: 'disabled' }, { id: 'jellyfin', state: 'disabled' }],
    profiles: config.advancedProfiles.map(({ id, kind, name }) => ({ id, kind, name })) })));
  app.post('/api/v1/resolve', async context => {
    const lifecycle = requestSignal(context);
    try {
      const reader = context.req.raw.body?.getReader();
      if (!reader) throw new ServiceError('INVALID_INPUT', 400);
      if (!context.req.header('content-type')?.toLowerCase().startsWith('application/json')) { reader.releaseLock(); throw new ServiceError('INVALID_INPUT', 400); }
      const abortRead = () => { void reader.cancel().catch(() => {}); };
      lifecycle.signal.addEventListener('abort', abortRead, { once: true });
      const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (lifecycle.signal.aborted) throw new ServiceError(Date.now() >= lifecycle.deadline ? 'UPSTREAM_TIMEOUT' : 'CANCELLED', Date.now() >= lifecycle.deadline ? 504 : 408);
          if (next.done) break;
          bytes += next.value.byteLength; if (bytes > LIMITS.requestBytes) { await reader.cancel(); throw new ServiceError('RESPONSE_TOO_LARGE', 413); }
          chunks.push(next.value);
        }
      } finally { lifecycle.signal.removeEventListener('abort', abortRead); reader.releaseLock(); }
      let input;
      try { input = ResolveInputSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { throw new ServiceError('INVALID_INPUT', 400); }
      const result = await resolver.resolve(input, lifecycle.signal, lifecycle.deadline);
      return context.json(result);
    } finally { lifecycle.dispose(); }
  });
  app.get('/api/v1/artwork/:ticket', async context => {
    resolver.artwork.get(context.req.param('ticket'));
    const lifecycle = requestSignal(context);
    try {
      const prepared = await resolver.artwork.open(context.req.param('ticket'), lifecycle.signal, lifecycle.deadline);
      const reader = prepared.body.getReader();
      const body = new ReadableStream<Uint8Array>({ async pull(controller) {
        try { const next = await reader.read(); if (next.done) { controller.close(); lifecycle.dispose(); } else controller.enqueue(next.value); }
        catch { controller.error(new Error('IMAGE_UNAVAILABLE')); lifecycle.dispose(); prepared.dispose(); }
      }, cancel() { void reader.cancel(); lifecycle.dispose(); prepared.dispose(); } });
      return new Response(body, { headers: { 'Content-Type': prepared.type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { lifecycle.dispose(); throw error; }
  });
  app.all('/api/*', () => { throw new ServiceError('UNSUPPORTED_SOURCE', 501); });
  app.use('*', serveStatic({ root: config.staticRoot }));
  app.get('*', serveStatic({ path: `${config.staticRoot}/index.html` }));
  return app;
}
