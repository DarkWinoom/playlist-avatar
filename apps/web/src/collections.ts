import type{SourceSnapshot}from'@playlist-avatar/contracts';
export interface ImageCollection{id:string;kind:'playlist'|'upload'|'recent'|'work';name:string;ids:string[];updatedAt:string;snapshot?:SourceSnapshot}
export function collectionIdentity(snapshot?:SourceSnapshot){return snapshot&&snapshot.source!=='local'?`source:${JSON.stringify([snapshot.source,snapshot.connectionId||'',snapshot.kind,snapshot.collectionId,snapshot.period||'',snapshot.from||'',snapshot.to||''])}`:'uploads';}
export function mergeCollection(previous:ImageCollection|undefined,ids:string[],snapshot?:SourceSnapshot,now=new Date().toISOString()):ImageCollection{
  const id=collectionIdentity(snapshot);
  return{id,kind:id==='uploads'?'upload':'playlist',name:id==='uploads'?'Uploads':snapshot!.title,ids:[...new Set([...previous?.ids||[],...ids])],updatedAt:now,snapshot};
}
