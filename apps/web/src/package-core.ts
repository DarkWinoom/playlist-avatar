import { Unzip,UnzipInflate,Zip,ZipPassThrough,strToU8 } from 'fflate';
import { AssetMetadataSchema,LIMITS,ProjectSchema,PackageManifestSchema } from '@playlist-avatar/contracts';
import type { ArtworkAsset,Project } from '@playlist-avatar/contracts';
import { normalizeAsset } from './assets.ts';
import { migrateProject } from './project-version.ts';
import { remapRecipeAssets } from './recipe-references.ts';
const manifestSchema=PackageManifestSchema;
export function validPackagePath(name:string){return name==='manifest.json'||/^(?:assets|thumbs)\/[a-f0-9]{64}\.png$/.test(name);}
export async function writePackage(project:Project,assets:ArtworkAsset[]){
 const parsed=ProjectSchema.parse(project),selected=[...new Set(parsed.recipe.assetIds)].map(id=>assets.find(a=>a.id===id));if(selected.some(a=>!a))throw new Error('INVALID_PACKAGE');
 const items=selected as ArtworkAsset[],manifest=manifestSchema.parse({format:'playlist-avatar',version:1,project:parsed,assets:items.map(a=>({...AssetMetadataSchema.parse(a),image:`assets/${a.fingerprint}.png`,thumbnail:`thumbs/${a.fingerprint}.png`}))});
 const text=strToU8(JSON.stringify(manifest));if(text.length>LIMITS.manifestBytes)throw new Error('INVALID_PACKAGE');
 const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;let finish!:()=>void,fail!:(error:unknown)=>void;const done=new Promise<void>((resolve,reject)=>{finish=resolve;fail=reject;});
 const zip=new Zip((error,chunk,final)=>{if(error){fail(error);return;}bytes+=chunk.length;if(bytes>LIMITS.packageBytes){zip.terminate();fail(new Error('RESPONSE_TOO_LARGE'));return;}chunks.push(new Uint8Array(chunk));if(final)finish();});
 async function add(name:string,blob:Blob){const entry=new ZipPassThrough(name);zip.add(entry);const reader=blob.stream().getReader();try{while(true){const next=await reader.read();if(next.done)break;entry.push(next.value);}entry.push(new Uint8Array(),true);}finally{reader.releaseLock();}}
 try{await add('manifest.json',new Blob([text]));for(const item of items){await add(`assets/${item.fingerprint}.png`,item.blob);await add(`thumbs/${item.fingerprint}.png`,item.thumbnail);}zip.end();await done;return new Blob(chunks,{type:'application/zip'});}finally{zip.terminate();}
}
export async function readPackage(file:Blob){
 if(file.size>LIMITS.packageBytes)throw new Error('RESPONSE_TOO_LARGE');const files=new Map<string,Blob>(),active=new Set<{terminate:()=>void}>();let count=0,total=0,failure:Error|undefined;
 const unzip=new Unzip(entry=>{if(++count>LIMITS.packageEntries||!validPackagePath(entry.name)||files.has(entry.name)||active.has(entry)){failure=new Error('INVALID_PACKAGE');throw failure;}
   const limit=entry.name==='manifest.json'?LIMITS.manifestBytes:LIMITS.localImageBytes;if(entry.originalSize!==undefined&&entry.originalSize>limit){failure=new Error('RESPONSE_TOO_LARGE');throw failure;}
   const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;active.add(entry);entry.ondata=(error,data,final)=>{if(error){failure??=new Error('INVALID_PACKAGE');throw failure;}bytes+=data.length;total+=data.length;if(bytes>limit||total>LIMITS.expandedPackageBytes){entry.terminate();failure=new Error('RESPONSE_TOO_LARGE');throw failure;}chunks.push(new Uint8Array(data));if(final){files.set(entry.name,new Blob(chunks));active.delete(entry);}};entry.start();});unzip.register(UnzipInflate);
 const names=new Set<string>();const discover=unzip.onfile;unzip.onfile=entry=>{if(names.has(entry.name))throw new Error('INVALID_PACKAGE');names.add(entry.name);discover(entry);};
 const reader=file.stream().getReader();try{while(true){const next=await reader.read();if(next.done)break;for(let i=0;i<next.value.length;i+=4096){unzip.push(next.value.subarray(i,i+4096));if(failure)throw failure;}}unzip.push(new Uint8Array(),true);if(active.size||failure)throw failure||new Error('INVALID_PACKAGE');}finally{reader.releaseLock();active.forEach(entry=>entry.terminate());}
 const manifestFile=files.get('manifest.json');if(!manifestFile)throw new Error('INVALID_PACKAGE');const manifest=manifestSchema.parse(JSON.parse(await manifestFile.text()));
 const allowed=new Set(['manifest.json',...manifest.assets.flatMap(a=>[a.image,a.thumbnail])]);if(files.size!==allowed.size||[...files.keys()].some(name=>!allowed.has(name)))throw new Error('INVALID_PACKAGE');
 const {project,migrated}=migrateProject(manifest.project),assets:ArtworkAsset[]=[],mapping=new Map<string,string>();let preparedBytes=0;
 for(const item of manifest.assets){if(item.image!==`assets/${item.fingerprint}.png`||item.thumbnail!==`thumbs/${item.fingerprint}.png`)throw new Error('INVALID_PACKAGE');const raw=files.get(item.image);if(!raw||raw.size!==item.bytes)throw new Error('INVALID_PACKAGE');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await raw.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==item.fingerprint)throw new Error('INVALID_PACKAGE');
   const asset=await normalizeAsset(raw,item.label,true,item.sourceKey);asset.statistics=item.statistics;asset.order=item.order;preparedBytes+=asset.bytes+asset.thumbnail.size;if(preparedBytes>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');mapping.set(item.id,asset.id);if(!assets.some(a=>a.id===asset.id))assets.push(asset);
 }
 const recipe=remapRecipeAssets(project.recipe,mapping);
 return {project:ProjectSchema.parse({...project,recipe}),assets,migrated};
}
