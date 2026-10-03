import {LIMITS}from'@playlist-avatar/contracts';import{abortError,ServiceError}from'./errors.ts';
export async function requestJSON(request:Request,signal:AbortSignal){
 const reader=request.body?.getReader();if(!reader||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ServiceError('INVALID_INPUT',400);
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const next=await reader.read();if(signal.aborted)throw abortError(signal);if(next.done)break;bytes+=next.value.length;if(bytes>LIMITS.requestBytes){await reader.cancel();throw new ServiceError('RESPONSE_TOO_LARGE',413);}chunks.push(next.value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new ServiceError('INVALID_INPUT',400);}}
 finally{signal.removeEventListener('abort',abort);reader.releaseLock();}
}
