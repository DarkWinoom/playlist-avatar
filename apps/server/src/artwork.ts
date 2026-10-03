import { randomBytes } from 'node:crypto';
import { LIMITS } from '@playlist-avatar/contracts';
import type { SourceId } from '@playlist-avatar/contracts';
import { imageInfo } from '../../../packages/artwork/src/image-info.ts';
import { upstream, safeTarget } from './network.ts';
import { ServiceError, abortError } from './errors.ts';
import { BoundedQueue } from './queue.ts';
import type {UpstreamOptions} from './network.ts';

export const publicArtworkHost = (host: string) => /^p\d+\.music\.126\.net$/.test(host) || host === 'y.gtimg.cn'||host==='lastfm.freetls.fastly.net'||host==='lastfm-img2.akamaized.net';
export const artworkHost=(source:SourceId)=>(host:string)=>source==='netease'?/^p\d+\.music\.126\.net$/.test(host):source==='qqmusic'?host==='y.gtimg.cn':source==='lastfm'?['lastfm.freetls.fastly.net','lastfm-img2.akamaized.net'].includes(host):false;
export type ArtworkPolicy=Pick<UpstreamOptions,'allowed'|'allowPrivate'|'headers'|'target'>;
interface Ticket { url: string; source: SourceId; expires: number;policy:ArtworkPolicy;realm?:string;revocation?:AbortSignal }
export class ArtworkTickets {
  private tickets = new Map<string, Ticket>();
  readonly queue = new BoundedQueue(LIMITS.images, 32);
  issue(source: SourceId, url: string, key: string,policy:ArtworkPolicy={allowed:artworkHost(source)},realm?:string,revocation?:AbortSignal) {
    safeTarget(url, policy.allowed,policy.target);
    for (const [id, record] of this.tickets) if (record.expires <= Date.now()) this.tickets.delete(id);
    while (this.tickets.size >= 512) this.tickets.delete(this.tickets.keys().next().value!);
    const id = randomBytes(24).toString('base64url');
    this.tickets.set(id, { source, url, expires: Date.now() + 600000,policy,realm,revocation });
    return { key, href: `/api/v1/artwork/${id}` };
  }
  get(id: string,realm?:string) {
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.expires <= Date.now()) { this.tickets.delete(id); throw new ServiceError('IMAGE_UNAVAILABLE', 404); }
    if(ticket.realm&&ticket.realm!==realm)throw new ServiceError('CONNECTION_REQUIRED',403);
    return ticket;
  }
  async open(id: string, signal: AbortSignal, deadline: number,realm?:string) {
    const ticket = this.get(id,realm);
    if(ticket.revocation)signal=AbortSignal.any([signal,ticket.revocation]);
    const release = await this.queue.acquire(signal);
    let response: Awaited<ReturnType<typeof upstream>> | undefined;
    let disposed = false;
    const dispose = () => { if (!disposed) { disposed = true; response?.dispose(); signal.removeEventListener('abort', dispose); release(); } };
    signal.addEventListener('abort', dispose, { once: true });
    try {
      for (let attempt = 0; ; attempt++) {
        try { response = await upstream(ticket.url, { ...ticket.policy,signal, deadline }); break; }
        catch (error) { if (attempt === 0 && error instanceof ServiceError && error.code === 'UPSTREAM_TIMEOUT' && Date.now() < deadline && !signal.aborted) continue; throw error; }
      }
      const declared = response.response.headers['content-type']?.split(';')[0]?.toLowerCase();
      const canonical = declared === 'image/jpg' ? 'image/jpeg' : declared;
      if (!['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'].includes(canonical || '')) throw new ServiceError('IMAGE_UNAVAILABLE', 422);
      const iterator = response.response[Symbol.asyncIterator]();
      let bytes = 0;
      let prefix = Buffer.alloc(0);
      let info;
      while (!info) {
        const next = await iterator.next();
        if (signal.aborted) throw abortError(signal);
        if (next.done) throw new ServiceError('IMAGE_UNAVAILABLE', 422);
        const chunk = Buffer.from(next.value); bytes += chunk.length;
        if (bytes > LIMITS.remoteImageBytes) throw new ServiceError('RESPONSE_TOO_LARGE', 413);
        prefix = Buffer.concat([prefix, chunk]); info = imageInfo(prefix);
        if (!info && prefix.length > 262144) throw new ServiceError('IMAGE_UNAVAILABLE', 422);
      }
      if (info.width <= 0 || info.height <= 0 || info.width * info.height > LIMITS.remotePixels
        || (canonical !== 'application/octet-stream' && canonical !== info.type)) throw new ServiceError('IMAGE_UNAVAILABLE', 422);
      let first: Uint8Array | undefined = prefix;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            if (signal.aborted || disposed) throw new ServiceError('CANCELLED', 408);
            if (first) { controller.enqueue(first); first = undefined; return; }
            const next = await iterator.next();
            if (next.done) { controller.close(); dispose(); return; }
            const chunk = new Uint8Array(next.value); bytes += chunk.byteLength;
            if (bytes > LIMITS.remoteImageBytes) throw new ServiceError('RESPONSE_TOO_LARGE', 413);
            controller.enqueue(chunk);
          } catch { controller.error(new ServiceError('IMAGE_UNAVAILABLE', 502)); dispose(); }
        }, cancel() { dispose(); },
      }, { highWaterMark: 1 });
      return { type: info.type, body, dispose };
    } catch (error) { dispose(); throw error; }
  }
}
