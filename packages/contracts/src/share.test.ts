import { describe, expect, it } from 'vitest';
import { identifyShare } from './share.ts';
describe('share identification', () => {
  it('extracts only the selected public playlist from share text and fragment links', () => {
    expect(identifyShare('分享歌单 https://music.163.com/#/playlist?id=3778678')).toEqual({ kind: 'playlist', source: 'netease', id: '3778678' });
    expect(identifyShare('https://y.qq.com/n/ryqq/playlist/9547521556')).toEqual({ kind: 'playlist', source: 'qqmusic', id: '9547521556' });
  });
  it('asks for platform on bare IDs without any network probes', () => {
    expect(identifyShare('3778678')).toEqual({ kind: 'platform', id: '3778678' });
    expect(identifyShare('3778678', 'netease')).toEqual({ kind: 'playlist', source: 'netease', id: '3778678' });
  });
  it('rejects personal pages, credentials and deceptive domains', () => {
    for (const input of ['https://music.163.com/user/home?id=123', 'https://music.163.com.evil.example/playlist?id=123',
      'https://music.163.com@127.0.0.1/playlist?id=123', 'https://user:password@music.163.com/playlist?id=123']) expect(() => identifyShare(input)).toThrow();
  });
});
