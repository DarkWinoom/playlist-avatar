import { describe, expect, it } from 'vitest';
import { CollectionSchema, CoverageSchema, StatisticsSchema, ResolveInputSchema, RecipeSchema, sourceKey, ConnectionProfileSchema } from './index.ts';

describe('source contracts', () => {
  it('keeps missing statistics distinct from actual zero and from ranking scores', () => {
    expect(StatisticsSchema.parse({})).toEqual({});
    expect(StatisticsSchema.parse({ playCount: 0, rankScore: 12 })).toEqual({ playCount: 0, rankScore: 12 });
    expect(StatisticsSchema.safeParse({ playCount: null }).success).toBe(false);
  });
  it('cannot label truncated verified totals as complete', () => {
    expect(CoverageSchema.safeParse({ received: 1000, knownTotal: 1261, complete: true }).success).toBe(false);
    expect(CoverageSchema.parse({ received: 1000, knownTotal: 1261, complete: false, limitReason: 'budget' }).received).toBe(1000);
    expect(CoverageSchema.parse({ received: 613, knownTotal: 613, reportedTotal: 620, complete: true }).complete).toBe(true);
    expect(CoverageSchema.safeParse({ received: 1, reportedTotal: 100, complete: true }).success).toBe(false);
    expect(CoverageSchema.safeParse({ received: 1, complete: true }).success).toBe(false);
    expect(CoverageSchema.safeParse({ offset: 99, received: 1, knownTotal: 100, complete: true }).success).toBe(false);
  });
  it('limits share text by UTF-8 bytes', () => {
    expect(ResolveInputSchema.safeParse({ input: '歌'.repeat(700) }).success).toBe(false);
    expect(ResolveInputSchema.parse({ input: '3778678', source: 'netease' }).offset).toBe(0);
  });
  it('rejects mixed-source entries and false coverage', () => {
    const data = { version: 1, snapshot: { key: sourceKey('netease', undefined, 'collection', 'p'), source: 'netease', collectionId: 'p', title: 'Example',
      kind: 'playlist', fetchedAt: '2026-10-03T00:00:00Z', coverage: { received: 1, knownTotal: 1, complete: true } },
      tracks: [{ key: sourceKey('qqmusic', undefined, 'track', 't', 0), source: 'qqmusic', sourceId: 't', title: 'Track', artists: [], order: 0 }] };
    expect(CollectionSchema.safeParse(data).success).toBe(false);
    data.tracks[0]!.source = 'netease'; expect(CollectionSchema.safeParse(data).success).toBe(false);
    data.tracks[0]!.key = sourceKey('netease', undefined, 'track', 't', 0); expect(CollectionSchema.safeParse(data).success).toBe(true);
    data.snapshot.coverage.received = 2; expect(CollectionSchema.safeParse(data).success).toBe(false);
  });
  it('isolates identical IDs across services and connection profiles', () => {
    expect(sourceKey('netease', undefined, 'track', '12', 0)).not.toBe(sourceKey('netease', 'public', 'track', '12', 0));
    const key = sourceKey('subsonic', 'account-one', 'track', '12', 0);
    expect(key).not.toBe(sourceKey('jellyfin', 'account-one', 'track', '12', 0));
    expect(key).not.toBe(sourceKey('subsonic', 'account-two', 'track', '12', 0));
    expect(sourceKey('subsonic', 'a:b', 'track', '12', 0)).not.toBe(sourceKey('subsonic', 'a', 'b:track', '12', 0));
  });
  it('keeps credentials and non-HTTP addresses out of connection display records', () => {
    const profile = { id: 'a', kind: 'subsonic', name: 'Library', implementation: 'OpenSubsonic', address: 'http://library:4533/music' };
    expect(ConnectionProfileSchema.safeParse(profile).success).toBe(true);
    expect(ConnectionProfileSchema.safeParse({ ...profile, address: 'http://user:password@library' }).success).toBe(false);
    expect(ConnectionProfileSchema.safeParse({ ...profile, address: 'file:///music' }).success).toBe(false);
    expect(ConnectionProfileSchema.safeParse({ ...profile, address: 'https://library/?token=secret' }).success).toBe(false);
  });
  it('allows independent template parameters without requiring all 16 templates', () => {
    expect(RecipeSchema.parse({ version: 1, template: 'mosaic', templateVersion: 1, assetIds: [], parameters: { mosaic: { columns: 2 } },
      seed: 1, palette: ['#D66641'], paletteLocked: false, title: '', titleEnabled: false, materialPhase: 0 }).parameters.mosaic?.columns).toBe(2);
  });
});
