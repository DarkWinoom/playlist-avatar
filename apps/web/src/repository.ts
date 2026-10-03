import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import { AssetMetadataSchema, LIMITS, ProjectSchema } from '@playlist-avatar/contracts';
import type { ArtworkAsset, AssetMetadata, Project, StoredProject } from '@playlist-avatar/contracts';

export interface LibraryRecord extends StoredProject { state: 'active' | 'trashed'; trashedAt?: string }
interface AssetData { id: string; blob: Blob; thumbnail: Blob }
interface StoredMetadata extends AssetMetadata { thumbnailBytes: number }
interface AvatarDatabase extends DBSchema {
  projects: { key: string; value: LibraryRecord; indexes: { updated: string } };
  metadata: { key: string; value: StoredMetadata };
  materials: { key: string; value: AssetData };
  connections: { key: string; value: { id: string; profileId: string; name: string; username: string; token: string; expiresAt: string } };
}
export function createRepository(name = 'playlist-avatar.v1') {
  const database = openDB<AvatarDatabase>(name, 1, { upgrade(db) {
    const projects = db.createObjectStore('projects', { keyPath: 'id' }); projects.createIndex('updated', 'updatedAt');
    db.createObjectStore('metadata', { keyPath: 'id' }); db.createObjectStore('materials', { keyPath: 'id' }); db.createObjectStore('connections', { keyPath: 'id' });
  } });
  const references=(record:unknown)=>{const parsed=ProjectSchema.safeParse(record);return parsed.success?parsed.data.recipe.assetIds:undefined;};
  const recordSize=(record:LibraryRecord)=>{try{return new TextEncoder().encode(JSON.stringify({...record,thumbnail:undefined})).length+(record.thumbnail instanceof Blob?record.thumbnail.size:0);}catch{return LIMITS.manifestBytes;}};
  async function save(project: Project, assets: ArtworkAsset[], thumbnail?: Blob, limit = LIMITS.projectBytes,signal?:AbortSignal) {
    const parsed = ProjectSchema.parse(project), needed = [...new Set(parsed.recipe.assetIds)], incoming = new Map(assets.map(a => [a.id,a]));
    const db = await database, tx = db.transaction(['projects','metadata','materials'],'readwrite');
    const cancel=()=>{try{tx.abort();}catch{}};if(signal?.aborted){cancel();await tx.done.catch(()=>{});throw new Error('CANCELLED');}signal?.addEventListener('abort',cancel,{once:true});
    try {
      const metadata = await tx.objectStore('metadata').getAll(), records = await tx.objectStore('projects').getAll();
      if(records.some(p=>p.id===parsed.id&&!references(p)))throw new Error('INVALID_PACKAGE');
      const other=records.filter(p=>p.id!==parsed.id),unknown=other.some(p=>!references(p));
      const retained = new Set([...other.flatMap(p=>references(p)||[]),...needed,...(unknown?metadata.map(a=>a.id):[])]);
      for(const asset of metadata)if(!retained.has(asset.id)){await tx.objectStore('metadata').delete(asset.id);await tx.objectStore('materials').delete(asset.id);}
      const kept=metadata.filter(a=>retained.has(a.id)),existing = new Set(kept.map(a=>a.id));
      if (needed.some(id => !existing.has(id) && !incoming.has(id))) throw new Error('INVALID_PACKAGE');
      const fresh = needed.filter(id=>!existing.has(id)).map(id=>incoming.get(id)!);
      const previous=records.find(p=>p.id===parsed.id),finalThumbnail=thumbnail||previous?.thumbnail;
      const recordBytes=other.reduce((sum,p)=>sum+recordSize(p),0);
      const bytes = kept.reduce((sum,a)=>sum+a.bytes+a.thumbnailBytes+new TextEncoder().encode(JSON.stringify(a)).length,0)+fresh.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size+new TextEncoder().encode(JSON.stringify({...AssetMetadataSchema.parse(a),thumbnailBytes:a.thumbnail.size})).length,0)+recordBytes+new TextEncoder().encode(JSON.stringify(parsed)).length+(finalThumbnail?.size||0);
      if (bytes > limit) throw new Error('STORAGE_FULL');
      for (const id of needed) { const asset=incoming.get(id);if(!asset)continue;
        if(existing.has(id)){const old=kept.find(a=>a.id===id)!;if(old.fingerprint!==asset.fingerprint||old.bytes!==asset.bytes)throw new Error('INVALID_PACKAGE');continue;}
        const {blob,thumbnail,...value}=asset;
        if(blob.size!==asset.bytes)throw new Error('INVALID_PACKAGE');
        await tx.objectStore('metadata').put({...AssetMetadataSchema.parse(value),thumbnailBytes:thumbnail.size});await tx.objectStore('materials').put({id,blob,thumbnail}); }
      await tx.objectStore('projects').put({...parsed,thumbnail:finalThumbnail,state:'active'});await tx.done;
    } catch(error) { try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error; }finally{signal?.removeEventListener('abort',cancel);}
  }
  async function get(id:string) {
    const db=await database,tx=db.transaction(['projects','metadata','materials']),project=await tx.objectStore('projects').get(id);if(!project)return;
    const parsed=ProjectSchema.parse(project),assets:ArtworkAsset[]=[];
    for(const key of [...new Set(parsed.recipe.assetIds)]){const metadata=await tx.objectStore('metadata').get(key),data=await tx.objectStore('materials').get(key);if(!metadata||!data)throw new Error('INVALID_PACKAGE');assets.push({...AssetMetadataSchema.parse(metadata),blob:data.blob,thumbnail:data.thumbnail});}await tx.done;
    return {project:{...parsed,state:project.state,thumbnail:project.thumbnail},assets};
  }
  async function list(state:'active'|'trashed'='active',count=50) {
    const db=await database,tx=db.transaction('projects'),output:LibraryRecord[]=[];let cursor=await tx.store.index('updated').openCursor(null,'prev');
    while(cursor&&output.length<count){if(cursor.value.id!=='draft'&&cursor.value.state===state)output.push(cursor.value);cursor=await cursor.continue();}return output;
  }
  async function state(id:string,value:'active'|'trashed') {const db=await database,tx=db.transaction('projects','readwrite'),record=await tx.store.get(id);if(!record)return;
    await tx.store.put({...record,state:value,trashedAt:value==='trashed'?new Date().toISOString():undefined});await tx.done;}
  async function rename(id:string,name:string){const db=await database,tx=db.transaction('projects','readwrite'),record=await tx.store.get(id);if(!record)return;const project=ProjectSchema.parse({...record,name,updatedAt:new Date().toISOString()});await tx.store.put({...record,...project});await tx.done;}
  async function clear(scopes:{draft:boolean;projects:boolean;connections:boolean}) {
    const db=await database,tx=db.transaction(['projects','metadata','materials','connections'],'readwrite');
    if(scopes.projects)for(const key of await tx.objectStore('projects').getAllKeys())if(key!=='draft')await tx.objectStore('projects').delete(key);
    if(scopes.draft)await tx.objectStore('projects').delete('draft');
    if(scopes.connections)await tx.objectStore('connections').clear();
    const remaining=await tx.objectStore('projects').getAll(),unknown=remaining.some(p=>!references(p)),retained=new Set(remaining.flatMap(p=>references(p)||[]));
    if(!unknown)for(const key of await tx.objectStore('metadata').getAllKeys())if(!retained.has(key)){await tx.objectStore('metadata').delete(key);await tx.objectStore('materials').delete(key);}await tx.done;
  }
  return {save,get,list,state,rename,clear,database};
}
let singleton: ReturnType<typeof createRepository> | undefined;
export function repository() { return singleton ??= createRepository(); }
export function storageMessage(error:unknown,chinese:boolean) {const full=error instanceof Error && ['QuotaExceededError','STORAGE_FULL'].includes(error.name==='QuotaExceededError'?error.name:error.message);
  return full?(chinese?'存储空间不足，请先备份作品':'Storage is full. Back up your artwork first.'):(chinese?'保存失败，作品仍在当前页面':'Save failed. Your artwork remains on this page.');}
