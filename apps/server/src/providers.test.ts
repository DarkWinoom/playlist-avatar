import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./network.ts', () => ({ upstreamJSON: vi.fn() }));
import { upstreamJSON } from './network.ts';
import { neteasePlaylist, qqPlaylist } from './providers.ts';
const request = vi.mocked(upstreamJSON);
const song = (id: number) => ({ id, name: `Track ${id}`, ar: [{ name: 'Artist' }], al: { id, name: 'Album', picUrl: 'https://p1.music.126.net/sample.jpg' } });
beforeEach(() => request.mockReset());
describe('provider completeness', () => {
  it('keeps malformed Netease ID slots as missing rather than shrinking total', async () => {
    request.mockResolvedValueOnce({ code: 200, playlist: { name: 'Example', trackCount: 2, trackIds: [{ id: 1 }, {}], tracks: [song(1)] } });
    const result = await neteasePlaylist('1', 0, new AbortController().signal, Date.now() + 30000);
    expect(result.tracks).toHaveLength(1); expect(result.snapshot.coverage).toMatchObject({ knownTotal: 2, complete: false, limitReason: 'missing-details' });
  });
  it('preserves the original sequence when detail responses are reordered', async () => {
    request.mockResolvedValueOnce({ code: 200, playlist: { name: 'Example', trackCount: 2, trackIds: [{ id: 2 }, { id: 1 }], tracks: [] } })
      .mockResolvedValueOnce({ code: 200, songs: [song(1), song(2)] });
    const result = await neteasePlaylist('1', 0, new AbortController().signal, Date.now() + 30000);
    expect(result.tracks.map(track => track.sourceId)).toEqual(['2', '1']); expect(result.snapshot.coverage.complete).toBe(true);
  });
  it('classifies HTTP-success business failures without asking for login', async () => {
    request.mockResolvedValueOnce({ code: 404 });
    await expect(neteasePlaylist('1', 0, new AbortController().signal, Date.now() + 30000)).rejects.toMatchObject({ code: 'NOT_PUBLIC_OR_UNAVAILABLE' });
    request.mockResolvedValueOnce({ code: 10 });
    await expect(qqPlaylist('1', 0, new AbortController().signal, Date.now() + 30000)).rejects.toMatchObject({ code: 'NOT_PUBLIC_OR_UNAVAILABLE' });
  });
});
