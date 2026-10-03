export type PublicPlatform = 'netease' | 'qqmusic';
export type ShareTarget = { kind: 'playlist'; source: PublicPlatform; id: string } | { kind: 'short'; source: PublicPlatform; url: string }
  | { kind: 'platform'; id: string };
const digits = /^\d{1,18}$/;
export function identifyShare(input: string, selected?: PublicPlatform): ShareTarget {
  const value = input.trim();
  if (digits.test(value)) return selected ? { kind: 'playlist', source: selected, id: value } : { kind: 'platform', id: value };
  const urls = value.match(/https?:\/\/[^\s<>"，。]+/gi) || [];
  if (urls.length !== 1) throw new Error('INVALID_INPUT');
  const url = new URL(urls[0]!);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('INVALID_INPUT');
  const host = url.hostname.toLowerCase();
  if (host === '163cn.tv') return { kind: 'short', source: 'netease', url: url.href };
  if (/^c\d?\.y\.qq\.com$/.test(host) && url.pathname === '/base/fcgi-bin/u') return { kind: 'short', source: 'qqmusic', url: url.href };
  if (['music.163.com', 'y.music.163.com'].includes(host)) {
    const path = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url;
    if (!/^\/(?:m\/)?playlist(?:\/|$)/.test(path.pathname)) throw new Error('INVALID_INPUT');
    const id = path.searchParams.get('id') || path.pathname.match(/\/playlist\/(\d+)$/)?.[1];
    if (!id || !digits.test(id)) throw new Error('INVALID_INPUT');
    return { kind: 'playlist', source: 'netease', id };
  }
  if (['y.qq.com', 'i.y.qq.com', 'c.y.qq.com'].includes(host)) {
    const direct = url.pathname.match(/^\/n\/ryqq\/playlist\/(\d+)$/)?.[1];
    const shared = /(?:taoge|songlist)/i.test(url.pathname) ? url.searchParams.get('id') || url.searchParams.get('disstid') : null;
    const id = direct || shared;
    if (!id || !digits.test(id)) throw new Error('INVALID_INPUT');
    return { kind: 'playlist', source: 'qqmusic', id };
  }
  throw new Error('UNSUPPORTED_SOURCE');
}
