import type {Coverage,SourceSnapshot} from '@playlist-avatar/contracts';
export function readEnd(coverage:Coverage){return coverage.offset+(coverage.scanned??coverage.received);}
export function canReadNext(snapshot:Pick<SourceSnapshot,'source'|'connectionId'|'coverage'>){const c=snapshot.coverage;return snapshot.connectionId===undefined&&['netease','qqmusic'].includes(snapshot.source)&&c.knownTotal!==undefined&&readEnd(c)>c.offset&&readEnd(c)<c.knownTotal;}
