import { LIMITS, sourceKey } from '@playlist-avatar/contracts';
import type { PublicPlatform, SourceSnapshot, Track } from '@playlist-avatar/contracts';
import { upstreamJSON, type UpstreamOptions } from './network.ts';
import { ServiceError } from './errors.ts';

type Raw = Record<string, unknown>;
export interface ProviderTrack extends Omit<Track, 'artwork'> { coverUrl?: string }
export interface ProviderResult { snapshot: SourceSnapshot; tracks: ProviderTrack[] }
const object = (value: unknown): Raw => value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown) => typeof value === 'string' ? value.slice(0, 1024) : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
const total = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const allowed = (source: PublicPlatform) => (host: string) => source === 'netease' ? host === 'music.163.com' : host === 'c.y.qq.com';
function options(source: PublicPlatform, signal: AbortSignal, deadline: number): UpstreamOptions {
  return { allowed: allowed(source), signal, deadline, headers: { Referer: source === 'netease' ? 'https://music.163.com/' : 'https://y.qq.com/' } };
}
function track(source: PublicPlatform, rawValue: unknown, order: number): ProviderTrack | undefined {
  const raw = object(rawValue);
  const id = string(raw.id ?? raw.songid ?? raw.mid ?? raw.songmid);
  const title = string(raw.name ?? raw.title ?? raw.songname);
  if (!id || !title) return;
  const album = object(raw.al ?? raw.album);
  const artists = array(raw.ar ?? raw.artists ?? raw.singer).map(value => string(object(value).name ?? object(value).title)).filter(Boolean).slice(0, 32);
  const albumId = string(album.id ?? raw.albumid);
  const albumName = string(album.name ?? album.title ?? raw.albumname);
  const mid = string(album.mid ?? raw.albummid);
  const coverUrl = source === 'netease' ? string(album.picUrl) : mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${mid}.jpg` : '';
  return { key: sourceKey(source, undefined, 'track', id, order), source, sourceId: id, kind: 'track', title,
    artists, albumId: albumId || undefined, album: albumName || undefined, order, coverUrl: coverUrl || undefined };
}
function result(source: PublicPlatform, id: string, title: string, tracks: ProviderTrack[], offset: number,
  knownTotal: number | undefined, reportedTotal: number | undefined, missing: boolean): ProviderResult {
  const complete = offset === 0 && !missing && knownTotal !== undefined && tracks.length === knownTotal;
  return { tracks, snapshot: { key: sourceKey(source, undefined, 'collection', id), source, collectionId: id, title,
    kind: 'playlist', fetchedAt: new Date().toISOString(), coverage: {
      received: tracks.length, offset, knownTotal, reportedTotal, complete,
      ...(complete ? {} : { limitReason: missing ? 'missing-details' as const : knownTotal === undefined ? 'unknown-total' as const : 'budget' as const }),
    }, warnings: missing || (knownTotal !== undefined && reportedTotal !== undefined && knownTotal !== reportedTotal) ? ['INCOMPLETE_SOURCE'] : [] } };
}

export async function neteasePlaylist(id: string, offset: number, signal: AbortSignal, deadline: number): Promise<ProviderResult> {
  const common = options('netease', signal, deadline);
  const payload = new URLSearchParams({ id, n: String(LIMITS.metadata), s: '0' }).toString();
  const raw = await upstreamJSON('https://music.163.com/api/v6/playlist/detail', {
    ...common, method: 'POST', headers: { ...common.headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload });
  if (raw.code === 404 || raw.code === 401 || raw.code === 403) throw new ServiceError('NOT_PUBLIC_OR_UNAVAILABLE', 404);
  if (raw.code !== 200 || !raw.playlist) throw new ServiceError('INCOMPLETE_SOURCE', 502);
  const playlist = object(raw.playlist);
  const ids = array(playlist.trackIds).map(value => string(object(value).id));
  const inline = array(playlist.tracks);
  const reported = total(playlist.trackCount);
  if (!ids.length) {
    const values = inline.slice(offset, offset + LIMITS.metadata).map((value, index) => track('netease', value, offset + index)).filter((value): value is ProviderTrack => !!value);
    if (reported && !values.length) throw new ServiceError('INCOMPLETE_SOURCE', 502);
    return result('netease', id, string(playlist.name), values, offset, reported ?? (inline.length === 0 ? 0 : undefined), reported, values.length !== inline.slice(offset, offset + LIMITS.metadata).length);
  }
  const selected = ids.slice(offset, offset + LIMITS.metadata);
  if (offset > ids.length) throw new ServiceError('INVALID_INPUT', 400);
  const songs = new Map(inline.map(value => [string(object(value).id), value]));
  const missing = [...new Set(selected.filter(value => /^\d+$/.test(value) && !songs.has(value)))];
  for (let index = 0; index < missing.length; index += 500) {
    const batch = missing.slice(index, index + 500);
    if (batch.some(value => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new ServiceError('INCOMPLETE_SOURCE', 502);
    const detail = await upstreamJSON('https://music.163.com/api/v3/song/detail', { ...common, method: 'POST',
      headers: { ...common.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ c: JSON.stringify(batch.map(value => ({ id: Number(value) }))) }).toString() });
    if (detail.code !== 200) throw new ServiceError('INCOMPLETE_SOURCE', 502);
    for (const value of array(detail.songs)) songs.set(string(object(value).id), value);
  }
  const tracks = selected.map((value, index) => track('netease', songs.get(value), offset + index)).filter((value): value is ProviderTrack => !!value);
  return result('netease', id, string(playlist.name), tracks, offset, ids.length, reported, tracks.length !== selected.length);
}

export async function qqPlaylist(id: string, offset: number, signal: AbortSignal, deadline: number): Promise<ProviderResult> {
  const common = options('qqmusic', signal, deadline);
  const tracks: ProviderTrack[] = [];
  let reported: number | undefined;
  let title = '';
  let missing = false;
  let previousPageIds: string | undefined;
  while (tracks.length < LIMITS.metadata) {
    const begin = offset + tracks.length;
    const size = Math.min(1000, LIMITS.metadata - tracks.length);
    const query = new URLSearchParams({ disstid: id, type: '1', json: '1', utf8: '1', onlysong: '0',
      new_format: '1', format: 'json', song_begin: String(begin), song_num: String(size) });
    const raw = await upstreamJSON(`https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${query}`, common);
    if ([10, -1, 10004].includes(Number(raw.code))) throw new ServiceError('NOT_PUBLIC_OR_UNAVAILABLE', 404);
    const cd = object(array(raw.cdlist)[0]);
    if (raw.code !== 0 || !Object.keys(cd).length) throw new ServiceError('INCOMPLETE_SOURCE', 502);
    if (!title) title = string(cd.dissname ?? cd.title);
    reported ??= total(cd.total_song_num ?? cd.songnum);
    const page = array(cd.songlist);
    const pageIds = page.map(value => string(object(value).id ?? object(value).songid)).join(',');
    if (page.length && (pageIds === previousPageIds || (tracks.length > 0 && pageIds === tracks.slice(0, page.length).map(value => value.sourceId).join(',')))) { missing = true; break; }
    if (typeof cd.song_begin === 'number' && cd.song_begin !== begin) { missing = true; break; }
    previousPageIds = pageIds;
    const parsed = page.slice(0, size).map((value, index) => track('qqmusic', value, begin + index)).filter((value): value is ProviderTrack => !!value);
    tracks.push(...parsed);
    if (parsed.length !== page.length) { missing = true; break; }
    if (reported !== undefined && offset + tracks.length >= reported) break;
    if (!page.length || page.length < size) { if (reported !== undefined && offset + tracks.length < reported) missing = true; break; }
  }
  if (reported && !tracks.length) throw new ServiceError('INCOMPLETE_SOURCE', 502);
  return result('qqmusic', id, title, tracks, offset, reported, reported, missing);
}
