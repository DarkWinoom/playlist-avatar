import { LIMITS, CONTRACT_VERSION, CollectionSchema, identifyShare, sourceKey } from '@playlist-avatar/contracts';
import type { Collection, ResolveInput, PublicPlatform } from '@playlist-avatar/contracts';
import { ArtworkTickets } from './artwork.ts';
import { neteasePlaylist, qqPlaylist, type ProviderResult } from './providers.ts';
import { ByteCache, BoundedQueue } from './queue.ts';
import { bodyBytes, upstream } from './network.ts';
import { ServiceError } from './errors.ts';
import { createHash } from 'node:crypto';

export class PublicResolver {
  readonly artwork = new ArtworkTickets();
  readonly queue = new BoundedQueue(LIMITS.resolves, LIMITS.queue);
  private cache = new ByteCache<ProviderResult>(16 * 1024 * 1024, 300000);
  async resolve(input: ResolveInput, signal: AbortSignal, deadline: number): Promise<Collection> {
    return this.queue.run(async () => {
      let target;
      try { target = identifyShare(input.input, input.source); }
      catch (error) { throw new ServiceError(error instanceof Error && error.message === 'UNSUPPORTED_SOURCE' ? 'UNSUPPORTED_SOURCE' : 'INVALID_INPUT', 400); }
      if (target.kind === 'platform') throw new ServiceError('INVALID_INPUT', 400);
      if (target.kind === 'short') {
        const expected = target.source;
        const allowed = (host: string) => expected === 'netease' ? ['163cn.tv', 'music.163.com', 'y.music.163.com'].includes(host)
          : host === 'y.qq.com' || host === 'i.y.qq.com' || /^c\d?\.y\.qq\.com$/.test(host);
        const response = await upstream(target.url, { allowed, signal, deadline });
        const finalURL = response.url;
        await bodyBytes(response);
        try { target = identifyShare(finalURL); } catch { throw new ServiceError('UNSUPPORTED_SOURCE', 400); }
        if (target.kind !== 'playlist' || target.source !== expected) throw new ServiceError('UNSUPPORTED_SOURCE', 400);
      }
      const { source, id } = target;
      const cacheKey = `${source}:${id}:${input.offset}`;
      let result = this.cache.get(cacheKey);
      if (!result) {
        result = await (source === 'netease' ? neteasePlaylist : qqPlaylist)(id, input.offset, signal, deadline);
        this.cache.set(cacheKey, result, Buffer.byteLength(JSON.stringify(result)));
      }
      const imageRefs = new Map<string, ReturnType<ArtworkTickets['issue']>>();
      const snapshot = structuredClone(result.snapshot);
      const tracks = result.tracks.map(value => {
        const { coverUrl, ...track } = value;
        if (!coverUrl) return track;
        const identity = value.albumId && value.albumId !== '0' ? value.albumId : createHash('sha256')
          .update(JSON.stringify([value.artists, value.album || null, value.album ? null : value.sourceId])).digest('hex');
        const artKey = sourceKey(source, undefined, 'artwork', identity);
        const existing = imageRefs.get(artKey);
        if (existing) return { ...track, artwork: existing };
        if (imageRefs.size >= LIMITS.candidates) return track;
        try {
          const ref = this.artwork.issue(source, coverUrl, artKey); imageRefs.set(artKey, ref); return { ...track, artwork: ref };
        } catch { if (!snapshot.warnings.includes('IMAGE_UNAVAILABLE')) snapshot.warnings.push('IMAGE_UNAVAILABLE'); return track; }
      });
      return CollectionSchema.parse({ version: CONTRACT_VERSION, snapshot, tracks });
    }, signal);
  }
}
