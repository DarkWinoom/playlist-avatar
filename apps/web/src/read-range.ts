import type {Coverage} from '@playlist-avatar/contracts';
export function readEnd(coverage:Coverage){return coverage.offset+(coverage.scanned??coverage.received);}
