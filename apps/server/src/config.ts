import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  port: number;
  host: string;
  publicOrigin: string;
  allowedOrigins: Set<string>;
  allowedHosts: Set<string>;
  staticRoot: string;
  lastfmKey?: string;
  advancedProfiles: Array<{ id: string; kind: 'subsonic' | 'jellyfin' | 'netease-api' | 'qq-api'; name: string; baseUrl: string; allowPrivate: boolean;implementation:string }>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
  const publicURL = new URL(env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`);
  if (!['http:', 'https:'].includes(publicURL.protocol) || publicURL.username || publicURL.password
    || publicURL.pathname !== '/' || publicURL.search || publicURL.hash) throw new Error('Invalid PUBLIC_ORIGIN');
  const origins = new Set([publicURL.origin]);
  const hosts = new Set([publicURL.host, `127.0.0.1:${port}`, `localhost:${port}`]);
  if (publicURL.hostname === '127.0.0.1') origins.add(`${publicURL.protocol}//localhost:${publicURL.port}`);
  if (env.NODE_ENV === 'development') { origins.add('http://127.0.0.1:5173'); origins.add('http://localhost:5173'); }
  const profiles: ServerConfig['advancedProfiles'] = [];
  if (env.ALLOWED_SERVICES) {
    const parsed: unknown = JSON.parse(env.ALLOWED_SERVICES);
    if (!Array.isArray(parsed) || parsed.length > 16) throw new Error('Invalid ALLOWED_SERVICES');
    for (const value of parsed) {
      if (!value || typeof value !== 'object') throw new Error('Invalid service profile');
      const p = value as Record<string, unknown>;
      if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.id) || typeof p.name !== 'string'
        || typeof p.baseUrl !== 'string' || !['subsonic', 'jellyfin', 'netease-api', 'qq-api'].includes(String(p.kind))) throw new Error('Invalid service profile');
      const url = new URL(p.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid service address');
      if (profiles.some(profile => profile.id === p.id)) throw new Error('Repeated service profile');
      profiles.push({ id: p.id, name: p.name.slice(0, 120), kind: p.kind as ServerConfig['advancedProfiles'][number]['kind'],
        baseUrl: url.href.replace(/\/$/, ''), allowPrivate: p.allowPrivate === true,implementation:typeof p.implementation==='string'?p.implementation.slice(0,128):p.kind==='subsonic'?'OpenSubsonic 1.16.1':p.kind==='jellyfin'?'Jellyfin 12.1.0':p.kind==='netease-api'?'Netease Enhanced a91ea':'QQMusicApi 13b08 (private sessions unverified)' });
    }
  }
  return { port, host: env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    publicOrigin: publicURL.origin, allowedOrigins: origins, allowedHosts: hosts,
    staticRoot: env.STATIC_DIR || fileURLToPath(new URL('../../web/dist/', import.meta.url)),
    lastfmKey: env.LASTFM_API_KEY || undefined, advancedProfiles: profiles };
}
