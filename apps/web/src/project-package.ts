import PackageWorker from'./package.worker.ts?worker';
import type{ArtworkAsset,Project}from'@playlist-avatar/contracts';
type PackageResult={project:Project;assets:ArtworkAsset[];migrated:boolean};
async function task<T>(message:unknown,signal?:AbortSignal){const worker=new PackageWorker();let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined;
 try{return await new Promise<T>((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('UPSTREAM_TIMEOUT')),60000);abort=()=>reject(new Error('CANCELLED'));if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});worker.onmessage=(event:MessageEvent<{value?:T;error?:string}>)=>event.data.error?reject(new Error(event.data.error)):resolve(event.data.value!);worker.onerror=()=>reject(new Error('INVALID_PACKAGE'));worker.postMessage(message);});}finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);worker.terminate();}
}
export function backupProject(project:Project,assets:ArtworkAsset[],signal?:AbortSignal){return task<Blob>({kind:'write',project,assets},signal);}
export function restorePackage(file:Blob,signal?:AbortSignal){return task<PackageResult>({kind:'read',file},signal);}
