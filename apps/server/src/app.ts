import { Hono } from 'hono';
import type{Context}from'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONTRACT_VERSION, LIMITS, CapabilitiesSchema } from '@playlist-avatar/contracts';
import type { ServerConfig } from './config.ts';
import { publicError, ServiceError } from './errors.ts';
import { PublicResolver } from './resolve.ts';
import { ResolveInputSchema } from '@playlist-avatar/contracts';
import{LastfmInputSchema,ConnectInputSchema,AdvancedInputSchema}from'@playlist-avatar/contracts';
import{AdvancedSources}from'./advanced.ts';import{lastfm}from'./lastfm.ts';import{requestJSON}from'./request.ts';
import{getCookie,setCookie}from'hono/cookie';import{createHash,randomBytes}from'node:crypto';

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
  const advanced=new AdvancedSources(config);
  function owner(context:Context){const cookie=getCookie(context,'pa_client');return cookie&&/^[\w-]{32}$/.test(cookie)?createHash('sha256').update(cookie).digest('hex'):undefined;}
  function session(context:Context){return advanced.require(context.req.header('authorization')?.replace(/^Bearer /,''),owner(context));}
  app.use('*', async (context, next) => {
    const host = context.req.header('host') || new URL(context.req.url).host;
    if (!config.allowedHosts.has(host)) throw new ServiceError('INVALID_INPUT', 403);
    const origin = context.req.header('origin');
    if (origin && !config.allowedOrigins.has(origin)) throw new ServiceError('INVALID_INPUT', 403);
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('Cross-Origin-Opener-Policy','same-origin');
    context.header('Cross-Origin-Embedder-Policy','require-corp');
    context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    context.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    await next();
  });
  app.onError((error, context) => {
    const failure = publicError(error);
    if (failure.body.error.code === 'INTERNAL_ERROR') console.error(JSON.stringify({ category: 'INTERNAL_ERROR' }));
    return context.json(failure.body, { status: failure.status });
  });
  app.get('/healthz', context => context.json({ status: 'ok', version: '0.2.1', contractVersion: CONTRACT_VERSION }));
  app.get('/api/v1/capabilities', context => context.json(CapabilitiesSchema.parse({ version: CONTRACT_VERSION,
    limits: { metadata: LIMITS.metadata, candidates: LIMITS.candidates, selected: LIMITS.selected },
    sources: [{ id: 'local', state: 'available' }, { id: 'netease', state: 'available' }, { id: 'qqmusic', state: 'available' },
      { id: 'lastfm', state: config.lastfmKey ? 'available' : 'unconfigured' }, { id: 'subsonic', state: config.advancedProfiles.some(p=>p.kind==='subsonic')?'available':'disabled' }, { id: 'jellyfin', state: config.advancedProfiles.some(p=>p.kind==='jellyfin')?'available':'disabled' }],
    profiles: config.advancedProfiles.map(({ id, kind, name,implementation }) => ({ id, kind, name,implementation })) })));
  app.post('/api/v1/lastfm',async context=>{const lifecycle=requestSignal(context);try{const input=LastfmInputSchema.safeParse(await requestJSON(context.req.raw,lifecycle.signal));if(!input.success)throw new ServiceError('INVALID_INPUT',400);const result=await resolver.queue.run(()=>lastfm(input.data.username,input.data.kind,input.data.period,config.lastfmKey,lifecycle.signal,lifecycle.deadline),lifecycle.signal);return context.json(resolver.normalize(result,'lastfm'));}finally{lifecycle.dispose();}});
  app.post('/api/v1/connections',async context=>{const lifecycle=requestSignal(context);try{const input=ConnectInputSchema.safeParse(await requestJSON(context.req.raw,lifecycle.signal));if(!input.success)throw new ServiceError('INVALID_INPUT',400);let identity=owner(context);if(!identity){const cookie=randomBytes(24).toString('base64url');setCookie(context,'pa_client',cookie,{httpOnly:true,sameSite:'Strict',path:'/',maxAge:86400,secure:config.publicOrigin.startsWith('https:')});identity=createHash('sha256').update(cookie).digest('hex');}const result=await resolver.queue.run(()=>advanced.connect(input.data,identity!,lifecycle.signal,lifecycle.deadline),lifecycle.signal);context.header('Cache-Control','no-store');return context.json(result);}finally{lifecycle.dispose();}});
  app.get('/api/v1/connections/collections',async context=>{const connection=session(context),lifecycle=requestSignal(context),signal=AbortSignal.any([lifecycle.signal,connection.controller.signal]);try{const items=await resolver.queue.run(()=>advanced.list(connection,signal,lifecycle.deadline),signal);context.header('Cache-Control','no-store');return context.json({items});}finally{lifecycle.dispose();}});
  app.post('/api/v1/connections/resolve',async context=>{const connection=session(context),lifecycle=requestSignal(context),signal=AbortSignal.any([lifecycle.signal,connection.controller.signal]);try{const input=AdvancedInputSchema.safeParse(await requestJSON(context.req.raw,lifecycle.signal));if(!input.success)throw new ServiceError('INVALID_INPUT',400);const result=await resolver.queue.run(()=>advanced.resolve(connection,input.data,signal,lifecycle.deadline),signal);context.header('Cache-Control','no-store');return context.json(resolver.normalize(result,result.snapshot.source,advanced.artworkPolicy(connection),connection.id,connection.controller.signal));}finally{lifecycle.dispose();}});
  app.delete('/api/v1/connections/current',context=>{const connection=session(context);advanced.disconnect(connection.id,connection.owner);context.header('Cache-Control','no-store');return context.json({status:'disconnected'});});
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
    const ticket=context.req.param('ticket');let realm:string|undefined;if(context.req.header('authorization'))realm=session(context).id;resolver.artwork.get(ticket,realm);
    const lifecycle = requestSignal(context);
    try {
      const prepared = await resolver.artwork.open(ticket, lifecycle.signal, lifecycle.deadline,realm);
      const reader = prepared.body.getReader();
      const body = new ReadableStream<Uint8Array>({ async pull(controller) {
        try { const next = await reader.read(); if (next.done) { controller.close(); lifecycle.dispose(); } else controller.enqueue(next.value); }
        catch { controller.error(new Error('IMAGE_UNAVAILABLE')); lifecycle.dispose(); prepared.dispose(); }
      }, cancel() { void reader.cancel(); lifecycle.dispose(); prepared.dispose(); } });
      return new Response(body, { headers: { 'Content-Type': prepared.type, 'Cache-Control': realm?'no-store':'private, max-age=300', 'Vary':'Authorization, Cookie', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { lifecycle.dispose(); throw error; }
  });
  app.all('/api/*', () => { throw new ServiceError('UNSUPPORTED_SOURCE', 501); });
  app.use('/assets/*',async(context,next)=>{context.header('Vary','Accept-Encoding');await next();const type=context.res.headers.get('Content-Type')||'';if(context.res.status===200&&(type.includes('javascript')||type.startsWith('text/css')))context.header('Cache-Control','public, max-age=31536000, immutable');});
  app.use('*', serveStatic({ root: config.staticRoot,precompressed:true }));
  app.get('*', serveStatic({ path: `${config.staticRoot}/index.html` }));
  return app;
}
