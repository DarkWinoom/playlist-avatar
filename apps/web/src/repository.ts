import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import { AssetMetadataSchema, LIMITS, ProjectSchema,recipeAssets } from '@playlist-avatar/contracts';
import type { ArtworkAsset, AssetMetadata, Project, StoredProject,SourceSnapshot } from '@playlist-avatar/contracts';

export interface LibraryRecord extends StoredProject { state: 'active' | 'trashed'; trashedAt?: string }
interface AssetData { id: string; blob: Blob; thumbnail: Blob }
interface StoredMetadata extends AssetMetadata { thumbnailBytes: number }
interface AvatarDatabase extends DBSchema {
  projects: { key: string; value: LibraryRecord; indexes: { updated: string } };
  metadata: { key: string; value: StoredMetadata };
  materials: { key: string; value: AssetData };
  connections: { key: string; value: { id: string; profileId: string; name: string; username: string; token: string; expiresAt: string } };
  imageLibrary:{key:string;value:{id:string;addedAt:string;snapshot?:SourceSnapshot};indexes:{added:string}};
}
export interface LibraryImage extends AssetMetadata{thumbnail:Blob;snapshot?:SourceSnapshot}
export function createRepository(name = 'playlist-avatar.v1') {
  const database = openDB<AvatarDatabase>(name, 2, { upgrade(db,oldVersion,_newVersion,transaction) {
    if(oldVersion<1){
    const projects = db.createObjectStore('projects', { keyPath: 'id' }); projects.createIndex('updated', 'updatedAt');
    db.createObjectStore('metadata', { keyPath: 'id' }); db.createObjectStore('materials', { keyPath: 'id' }); db.createObjectStore('connections', { keyPath: 'id' });
    }
    if(oldVersion<2){const library=db.createObjectStore('imageLibrary',{keyPath:'id'});library.createIndex('added','addedAt');if(oldVersion===1)void(async()=>{let cursor=await transaction.objectStore('metadata').openCursor();while(cursor){const parsed=AssetMetadataSchema.safeParse(cursor.value);if(parsed.success&&parsed.data.isSample!==true)await library.put({id:parsed.data.id,addedAt:parsed.data.createdAt});cursor=await cursor.continue();}})();}
  } });
  const references=(record:unknown)=>{const parsed=ProjectSchema.safeParse(record);return parsed.success?recipeAssets(parsed.data.recipe):undefined;};
  const recordSize=(record:LibraryRecord)=>{try{return new TextEncoder().encode(JSON.stringify({...record,thumbnail:undefined})).length+(record.thumbnail instanceof Blob?record.thumbnail.size:0);}catch{return LIMITS.manifestBytes;}};
  async function save(project: Project, assets: ArtworkAsset[], thumbnail?: Blob, limit = LIMITS.projectBytes,signal?:AbortSignal,linkImages=false) {
    const parsed = ProjectSchema.parse(project), needed = recipeAssets(parsed.recipe), incoming = new Map(assets.map(a => [a.id,a]));
    const db = await database, tx = db.transaction(['projects','metadata','materials','imageLibrary'],'readwrite');
    const cancel=()=>{try{tx.abort();}catch{}};if(signal?.aborted){cancel();await tx.done.catch(()=>{});throw new Error('CANCELLED');}signal?.addEventListener('abort',cancel,{once:true});
    try {
      const metadata = await tx.objectStore('metadata').getAll(), records = await tx.objectStore('projects').getAll();
      if(records.some(p=>p.id===parsed.id&&!references(p)))throw new Error('INVALID_PACKAGE');
      const other=records.filter(p=>p.id!==parsed.id),unknown=other.some(p=>!references(p));
      let library=await tx.objectStore('imageLibrary').getAll();
      if(linkImages){library=[...new Map([...library,...needed.map(id=>({id,addedAt:new Date().toISOString(),snapshot:parsed.snapshot}))].map(item=>[item.id,item])).values()];if(library.length>1000)throw Error('STORAGE_FULL');}
      const retained = new Set([...other.flatMap(p=>references(p)||[]),...needed,...library.map(a=>a.id),...(unknown?metadata.map(a=>a.id):[])]);
      for(const asset of metadata)if(!retained.has(asset.id)){await tx.objectStore('metadata').delete(asset.id);await tx.objectStore('materials').delete(asset.id);}
      const kept=metadata.filter(a=>retained.has(a.id)),existing = new Set(kept.map(a=>a.id));
      if (needed.some(id => !existing.has(id) && !incoming.has(id))) throw new Error('INVALID_PACKAGE');
      const fresh = needed.filter(id=>!existing.has(id)).map(id=>incoming.get(id)!);
      const previous=records.find(p=>p.id===parsed.id),finalThumbnail=thumbnail||previous?.thumbnail;
      const recordBytes=other.reduce((sum,p)=>sum+recordSize(p),0)+new TextEncoder().encode(JSON.stringify(library)).length;
      const bytes = kept.reduce((sum,a)=>sum+a.bytes+a.thumbnailBytes+new TextEncoder().encode(JSON.stringify(a)).length,0)+fresh.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size+new TextEncoder().encode(JSON.stringify({...AssetMetadataSchema.parse(a),thumbnailBytes:a.thumbnail.size})).length,0)+recordBytes+new TextEncoder().encode(JSON.stringify(parsed)).length+(finalThumbnail?.size||0);
      if (bytes > limit) throw new Error('STORAGE_FULL');
      for (const id of needed) { const asset=incoming.get(id);if(!asset)continue;
        if(existing.has(id)){const old=kept.find(a=>a.id===id)!;if(old.fingerprint!==asset.fingerprint||old.bytes!==asset.bytes)throw new Error('INVALID_PACKAGE');continue;}
        const {blob,thumbnail,...value}=asset;
        if(blob.size!==asset.bytes)throw new Error('INVALID_PACKAGE');
        await tx.objectStore('metadata').put({...AssetMetadataSchema.parse(value),thumbnailBytes:thumbnail.size});await tx.objectStore('materials').put({id,blob,thumbnail}); }
      if(linkImages)for(const item of library)await tx.objectStore('imageLibrary').put(item);
      await tx.objectStore('projects').put({...parsed,thumbnail:finalThumbnail,state:'active'});await tx.done;
    } catch(error) { try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error; }finally{signal?.removeEventListener('abort',cancel);}
  }
  async function get(id:string) {
    const db=await database,tx=db.transaction(['projects','metadata','materials']),project=await tx.objectStore('projects').get(id);if(!project)return;
    const parsed=ProjectSchema.parse(project),assets:ArtworkAsset[]=[];
    for(const key of recipeAssets(parsed.recipe)){const metadata=await tx.objectStore('metadata').get(key),data=await tx.objectStore('materials').get(key);if(!metadata||!data)throw new Error('INVALID_PACKAGE');assets.push({...AssetMetadataSchema.parse(metadata),blob:data.blob,thumbnail:data.thumbnail});}await tx.done;
    return {project:{...parsed,state:project.state,thumbnail:project.thumbnail},assets};
  }
  async function list(state:'active'|'trashed'='active',count=50) {
    const db=await database,tx=db.transaction('projects'),output:LibraryRecord[]=[];let cursor=await tx.store.index('updated').openCursor(null,'prev');
    while(cursor&&output.length<count){if(cursor.value.id!=='draft'&&cursor.value.state===state)output.push(cursor.value);cursor=await cursor.continue();}return output;
  }
  async function state(id:string,value:'active'|'trashed') {const db=await database,tx=db.transaction('projects','readwrite'),record=await tx.store.get(id);if(!record)return;
    await tx.store.put({...record,state:value,trashedAt:value==='trashed'?new Date().toISOString():undefined});await tx.done;}
  async function rename(id:string,name:string){const db=await database,tx=db.transaction('projects','readwrite'),record=await tx.store.get(id);if(!record)return;const project=ProjectSchema.parse({...record,name,updatedAt:new Date().toISOString()});await tx.store.put({...record,...project});await tx.done;}
  async function clear(scopes:{draft:boolean;projects:boolean;connections:boolean;images?:boolean}) {
    const db=await database,tx=db.transaction(['projects','metadata','materials','connections','imageLibrary'],'readwrite');
    if(scopes.projects)for(const key of await tx.objectStore('projects').getAllKeys())if(key!=='draft')await tx.objectStore('projects').delete(key);
    if(scopes.draft)await tx.objectStore('projects').delete('draft');
    if(scopes.connections)await tx.objectStore('connections').clear();
    if(scopes.images)await tx.objectStore('imageLibrary').clear();
    const remaining=await tx.objectStore('projects').getAll(),library=await tx.objectStore('imageLibrary').getAll(),unknown=remaining.some(p=>!references(p)),retained=new Set([...remaining.flatMap(p=>references(p)||[]),...library.map(a=>a.id)]);
    if(!unknown)for(const key of await tx.objectStore('metadata').getAllKeys())if(!retained.has(key)){await tx.objectStore('metadata').delete(key);await tx.objectStore('materials').delete(key);}await tx.done;
  }
  async function saveImages(assets:ArtworkAsset[],snapshot?:SourceSnapshot,signal?:AbortSignal){
    if(assets.length>LIMITS.candidates||assets.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw Error('RESPONSE_TOO_LARGE');
    const db=await database,tx=db.transaction(['projects','metadata','materials','imageLibrary'],'readwrite'),cancel=()=>{try{tx.abort();}catch{}};signal?.addEventListener('abort',cancel,{once:true});
    try{if(signal?.aborted)throw Error('CANCELLED');const metadata=await tx.objectStore('metadata').getAll(),records=await tx.objectStore('projects').getAll(),library=await tx.objectStore('imageLibrary').getAll(),existing=new Map(metadata.map(a=>[a.id,a]));
      const fresh=[...new Map(assets.filter(a=>!existing.has(a.id)).map(a=>[a.id,a])).values()];
      if(new Set([...library.map(a=>a.id),...assets.map(a=>a.id)]).size>1000)throw Error('STORAGE_FULL');
      const bytes=metadata.reduce((sum,a)=>sum+a.bytes+a.thumbnailBytes+new TextEncoder().encode(JSON.stringify(a)).length,0)+records.reduce((sum,p)=>sum+recordSize(p),0)+new TextEncoder().encode(JSON.stringify(library)).length+fresh.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size+new TextEncoder().encode(JSON.stringify(AssetMetadataSchema.parse(a))).length,0)+assets.length*(new TextEncoder().encode(JSON.stringify(snapshot)).length+100);
      if(bytes>LIMITS.projectBytes)throw Error('STORAGE_FULL');
      for(const asset of assets){const parsed=AssetMetadataSchema.parse(asset),old=existing.get(asset.id);if(asset.bytes!==asset.blob.size||old&&(old.fingerprint!==asset.fingerprint||old.bytes!==asset.bytes))throw Error('INVALID_PACKAGE');if(!old){await tx.objectStore('metadata').put({...parsed,thumbnailBytes:asset.thumbnail.size});await tx.objectStore('materials').put({id:asset.id,blob:asset.blob,thumbnail:asset.thumbnail});}await tx.objectStore('imageLibrary').put({id:asset.id,addedAt:new Date().toISOString(),snapshot});}
      await tx.done;
    }catch(error){cancel();await tx.done.catch(()=>{});throw error;}finally{signal?.removeEventListener('abort',cancel);}
  }
  async function listImages(limit=50){const db=await database,tx=db.transaction(['imageLibrary','metadata','materials']),rows:LibraryImage[]=[];let cursor=await tx.objectStore('imageLibrary').index('added').openCursor(null,'prev');while(cursor&&rows.length<Math.min(1000,limit)){const metadata=await tx.objectStore('metadata').get(cursor.value.id),data=await tx.objectStore('materials').get(cursor.value.id);if(metadata&&data)rows.push({...AssetMetadataSchema.parse(metadata),thumbnail:data.thumbnail,snapshot:cursor.value.snapshot});cursor=await cursor.continue();}await tx.done;return rows;}
  async function getImages(ids:string[]){if(new Set(ids).size>LIMITS.candidates)throw Error('RESPONSE_TOO_LARGE');const db=await database,tx=db.transaction(['metadata','materials']),assets:ArtworkAsset[]=[];for(const id of new Set(ids)){const meta=await tx.objectStore('metadata').get(id),data=await tx.objectStore('materials').get(id);if(!meta||!data)throw Error('INVALID_PACKAGE');assets.push({...AssetMetadataSchema.parse(meta),blob:data.blob,thumbnail:data.thumbnail});}await tx.done;return assets;}
  async function removeImage(id:string){const db=await database,tx=db.transaction(['imageLibrary','projects','metadata','materials'],'readwrite');await tx.objectStore('imageLibrary').delete(id);const records=await tx.objectStore('projects').getAll();if(!records.some(p=>!references(p)||references(p)?.includes(id))){await tx.objectStore('metadata').delete(id);await tx.objectStore('materials').delete(id);}await tx.done;}
  return {save,get,list,state,rename,clear,database,saveImages,listImages,getImages,removeImage};
}
let singleton: ReturnType<typeof createRepository> | undefined;
export function repository() { return singleton ??= createRepository(); }
export function storageMessage(error:unknown,chinese:boolean) {const full=error instanceof Error && ['QuotaExceededError','STORAGE_FULL'].includes(error.name==='QuotaExceededError'?error.name:error.message);
  return full?(chinese?'存储空间不足，请先备份作品':'Storage is full. Back up your artwork first.'):(chinese?'保存失败，作品仍在当前页面':'Save failed. Your artwork remains on this page.');}
