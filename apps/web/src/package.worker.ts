import {readPackage,writePackage}from'./package-core.ts';
import type{ArtworkAsset,Project}from'@playlist-avatar/contracts';
const worker=self as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(value:unknown)=>void};
worker.onmessage=async(event:MessageEvent<{kind:'read';file:Blob}|{kind:'write';project:Project;assets:ArtworkAsset[]}>)=>{try{worker.postMessage({value:event.data.kind==='read'?await readPackage(event.data.file):await writePackage(event.data.project,event.data.assets)});}catch(error){worker.postMessage({error:error instanceof Error?error.message:'INVALID_PACKAGE'});}};
