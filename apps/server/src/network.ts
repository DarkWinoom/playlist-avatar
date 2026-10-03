import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import type { Readable } from 'node:stream';
import { LIMITS } from '@playlist-avatar/contracts';
import { ServiceError, abortError } from './errors.ts';

const denied = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['192.88.99.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) denied.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['::', 96], ['64:ff9b::', 96], ['100::', 64],
  ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) denied.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !denied.check(address, 'ipv4');
  if (family === 6) return /^[23]/i.test(address) && !denied.check(address, 'ipv6');
  return false;
}
export function safeTarget(input: string | URL, allowed: (host: string) => boolean) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !allowed(url.hostname)
    || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) throw new ServiceError('INVALID_INPUT', 400);
  return url;
}
export interface UpstreamOptions {
  allowed: (host: string) => boolean;
  signal: AbortSignal;
  deadline: number;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  allowPrivate?: boolean;
}
export interface UpstreamResponse { response: http.IncomingMessage; url: string; dispose(): void }

export async function upstream(input: string | URL, options: UpstreamOptions, hop = 0): Promise<UpstreamResponse> {
  const url = safeTarget(input, options.allowed);
  if (options.signal.aborted) throw abortError(options.signal);
  const remaining = Math.min(LIMITS.requestMs, options.deadline - Date.now());
  if (remaining <= 0) throw new ServiceError('UPSTREAM_TIMEOUT', 504);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, { method: options.method || 'GET', agent: false, signal: options.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        'Accept-Encoding': 'identity', ...options.headers },
      lookup(hostname, settings, callback) {
        lookup(hostname, { all: true }, (error, addresses) => {
          if (error) { callback(error, []); return; }
          if (!addresses.length || (!options.allowPrivate && addresses.some(value => !isPublicAddress(value.address)))) {
            callback(new ServiceError('INVALID_INPUT', 403), []); return;
          }
          const ordered = addresses.sort((a, b) => a.family - b.family);
          if (settings.all) callback(null, ordered);
          else callback(null, ordered[0]!.address, ordered[0]!.family);
        });
      } }, response => {
      const status = response.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy(); request.destroy(); clearTimeout(timer);
        if (hop >= LIMITS.redirects || !location) { reject(new ServiceError('INVALID_INPUT', 400)); return; }
        try {
          const target = new URL(location, url);
          if (url.protocol === 'https:' && target.protocol !== 'https:') { reject(new ServiceError('INVALID_INPUT', 403)); return; }
          upstream(target, status === 303 ? { ...options, method: 'GET', body: undefined } : options, hop + 1).then(resolve, reject);
        } catch { reject(new ServiceError('INVALID_INPUT', 400)); }
        return;
      }
      if (status === 429) {
        const value = response.headers['retry-after'];
        const retryMs = value ? Math.max(0, Math.min(30000, /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now())) : 2000;
        response.destroy(); clearTimeout(timer); reject(new ServiceError('RATE_LIMITED', 429, Number.isFinite(retryMs) ? retryMs : 2000)); return;
      }
      if (status !== 200) {
        response.destroy(); clearTimeout(timer); reject(new ServiceError('NOT_PUBLIC_OR_UNAVAILABLE', status >= 500 ? 502 : 404)); return;
      }
      resolve({ response, url: url.href, dispose() { clearTimeout(timer); response.destroy(); request.destroy(); } });
    });
    const timer = setTimeout(() => request.destroy(new ServiceError('UPSTREAM_TIMEOUT', 504)), remaining);
    request.once('error', error => {
      clearTimeout(timer);
      reject(error instanceof ServiceError ? error : options.signal.aborted ? abortError(options.signal) : new ServiceError('UPSTREAM_TIMEOUT', 504));
    });
    if (options.body) request.write(options.body);
    request.end();
  });
}

export async function bodyBytes(result: UpstreamResponse, maxBytes = LIMITS.upstreamBytes) {
  const response = result.response;
  const encoding = response.headers['content-encoding'];
  let stream: Readable = response;
  if (encoding === 'gzip') stream = response.pipe(createGunzip());
  else if (encoding === 'deflate') stream = response.pipe(createInflate());
  else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
  else if (encoding && encoding !== 'identity') { result.dispose(); throw new ServiceError('RESPONSE_TOO_LARGE', 413); }
  if (stream !== response) response.once('error', error => stream.destroy(error));
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += data.length;
      if (size > maxBytes) throw new ServiceError('RESPONSE_TOO_LARGE', 413);
      chunks.push(data);
    }
    return Buffer.concat(chunks, size);
  } finally { if (stream !== response) stream.destroy(); result.dispose(); }
}
export async function upstreamJSON(input: string | URL, options: UpstreamOptions): Promise<Record<string, unknown>> {
  for (let attempt = 0; ; attempt++) {
    try {
      const data: unknown = JSON.parse((await bodyBytes(await upstream(input, options))).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ServiceError('INCOMPLETE_SOURCE', 502);
      return data as Record<string, unknown>;
    } catch (error) {
      if (options.signal.aborted) throw abortError(options.signal);
      if (attempt === 0 && error instanceof ServiceError && error.code === 'UPSTREAM_TIMEOUT' && Date.now() < options.deadline && !options.signal.aborted) continue;
      throw error instanceof ServiceError ? error : new ServiceError('INCOMPLETE_SOURCE', 502);
    }
  }
}
